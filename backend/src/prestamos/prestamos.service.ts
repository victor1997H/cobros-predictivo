import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { Cliente } from '../clientes/entities/cliente.entity';
import { ClienteRepository } from '../clientes/repositories/cliente.repository';
import { Cuota } from '../cuotas/entities/cuota.entity';
import { CuotaRepository } from '../cuotas/repositories/cuota.repository';
import { CreatePrestamoDto } from './dto/create-prestamo.dto';
import { UpdatePrestamoDto } from './dto/update-prestamo.dto';
import { Prestamo } from './entities/prestamo.entity';
import { PrestamoRepository } from './repositories/prestamo.repository';

export interface PrestamoResponse {
  success: boolean;
  message: string;
  prestamo: PrestamoDetalle;
  cuotasGeneradas?: Cuota[];
}

export interface PrestamosResponse {
  success: boolean;
  message: string;
  prestamos: PrestamoDetalle[];
}

export type PrestamoDetalle = Omit<Prestamo, 'cuotas'> & {
  tieneCuotasGeneradas: boolean;
  tienePagosRegistrados: boolean;
  puedeEditarCondicionesFinancieras: boolean;
  motivoBloqueoEdicion: string | null;
};

type CampoFinancieroBloqueado =
  'clienteId' | 'monto' | 'fechaInicio' | 'numeroCuotas';

const CAMPOS_FINANCIEROS_BLOQUEADOS: CampoFinancieroBloqueado[] = [
  'clienteId',
  'monto',
  'fechaInicio',
  'numeroCuotas',
];

const MENSAJE_CUOTAS_GENERADAS =
  'El prestamo ya tiene cuotas generadas. Las condiciones financieras no pueden modificarse.';

const MENSAJE_PAGOS_REGISTRADOS =
  'El prestamo ya tiene pagos registrados y no se pueden modificar sus condiciones financieras.';

const MENSAJES_POR_CAMPO: Record<CampoFinancieroBloqueado, string> = {
  clienteId:
    'El prestamo ya tiene cuotas generadas y no se puede cambiar el cliente asociado.',
  monto:
    'El prestamo ya tiene cuotas generadas y no se puede modificar el monto.',
  fechaInicio:
    'El prestamo ya tiene cuotas generadas y no se puede modificar la fecha de inicio.',
  numeroCuotas:
    'El prestamo ya tiene cuotas generadas y no se puede modificar el numero de cuotas.',
};

@Injectable()
export class PrestamosService {
  constructor(
    private readonly prestamoRepository: PrestamoRepository,
    private readonly clienteRepository: ClienteRepository,
    private readonly cuotaRepository: CuotaRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<PrestamosResponse> {
    const prestamos = await this.prestamoRepository.findAll();

    return {
      success: true,
      message: 'Prestamos obtenidos correctamente',
      prestamos: prestamos.map((prestamo) => this.toPrestamoDetalle(prestamo)),
    };
  }

  async findOne(id: number): Promise<PrestamoResponse> {
    const prestamo = await this.findPrestamoById(id);

    return {
      success: true,
      message: 'Prestamo obtenido correctamente',
      prestamo: this.toPrestamoDetalle(prestamo),
    };
  }

  async create(data: CreatePrestamoDto): Promise<PrestamoResponse> {
    const {
      clienteId,
      generarCuotas,
      fechaPrimerVencimiento,
      ...prestamoData
    } = data;
    const { savedPrestamo, cuotasGeneradas } =
      await this.dataSource.transaction(async (manager) => {
        const cliente = await this.findClienteById(clienteId, manager);
        const prestamoRepository = manager.getRepository(Prestamo);
        const prestamo = prestamoRepository.create({
          ...prestamoData,
          estado: prestamoData.estado ?? 'ACTIVO',
          cliente,
          clienteId: cliente.id,
        });
        const savedPrestamo = await prestamoRepository.save(prestamo);
        const cuotasGeneradas = generarCuotas
          ? await this.generarCuotas(
              savedPrestamo,
              fechaPrimerVencimiento,
              manager,
            )
          : [];

        return {
          savedPrestamo,
          cuotasGeneradas,
        };
      });

    return {
      success: true,
      message:
        cuotasGeneradas.length > 0
          ? 'Prestamo creado correctamente con cuotas generadas'
          : 'Prestamo creado correctamente',
      prestamo: this.toPrestamoDetalle({
        ...savedPrestamo,
        cuotas: cuotasGeneradas,
      }),
      cuotasGeneradas,
    };
  }

  async update(id: number, data: UpdatePrestamoDto): Promise<PrestamoResponse> {
    const prestamo = await this.findPrestamoById(id);

    this.validarEdicionNormal(prestamo, data);

    const { clienteId, ...prestamoData } = data;
    const cliente =
      clienteId === undefined
        ? undefined
        : await this.findClienteById(clienteId);

    const updatedPrestamo = this.prestamoRepository.merge(
      prestamo,
      prestamoData,
      cliente,
    );
    const savedPrestamo = await this.prestamoRepository.save(updatedPrestamo);

    return {
      success: true,
      message: 'Prestamo actualizado correctamente',
      prestamo: this.toPrestamoDetalle(savedPrestamo),
    };
  }

  async remove(id: number): Promise<{ success: boolean; message: string }> {
    const prestamo = await this.findPrestamoById(id);

    await this.prestamoRepository.delete(prestamo);

    return {
      success: true,
      message: 'Prestamo eliminado correctamente',
    };
  }

  private async findPrestamoById(id: number): Promise<Prestamo> {
    const prestamo = await this.prestamoRepository.findById(id);

    if (!prestamo) {
      throw new NotFoundException('Prestamo no encontrado');
    }

    return prestamo;
  }

  private validarEdicionNormal(
    prestamo: Prestamo,
    data: UpdatePrestamoDto,
  ): void {
    const estadoEdicion = this.obtenerEstadoEdicion(prestamo);

    if (!estadoEdicion.tieneCuotasGeneradas) {
      return;
    }

    const campoModificado = CAMPOS_FINANCIEROS_BLOQUEADOS.find((campo) =>
      this.campoBloqueadoCambia(prestamo, data, campo),
    );

    if (!campoModificado) {
      return;
    }

    if (estadoEdicion.tienePagosRegistrados) {
      throw new BadRequestException(MENSAJE_PAGOS_REGISTRADOS);
    }

    throw new BadRequestException(MENSAJES_POR_CAMPO[campoModificado]);
  }

  private campoBloqueadoCambia(
    prestamo: Prestamo,
    data: UpdatePrestamoDto,
    campo: CampoFinancieroBloqueado,
  ): boolean {
    const nuevoValor = data[campo];

    if (nuevoValor === undefined) {
      return false;
    }

    if (campo === 'monto') {
      return this.toMoney(nuevoValor) !== this.toMoney(prestamo.monto);
    }

    if (campo === 'clienteId' || campo === 'numeroCuotas') {
      return Number(nuevoValor) !== Number(prestamo[campo]);
    }

    return String(nuevoValor) !== String(prestamo[campo]);
  }

  private toPrestamoDetalle(prestamo: Prestamo): PrestamoDetalle {
    const estadoEdicion = this.obtenerEstadoEdicion(prestamo);

    return {
      id: prestamo.id,
      clienteId: prestamo.clienteId,
      cliente: prestamo.cliente,
      monto: prestamo.monto,
      fechaInicio: prestamo.fechaInicio,
      numeroCuotas: prestamo.numeroCuotas,
      estado: prestamo.estado,
      createdAt: prestamo.createdAt,
      updatedAt: prestamo.updatedAt,
      tieneCuotasGeneradas: estadoEdicion.tieneCuotasGeneradas,
      tienePagosRegistrados: estadoEdicion.tienePagosRegistrados,
      puedeEditarCondicionesFinancieras:
        !estadoEdicion.tieneCuotasGeneradas &&
        !estadoEdicion.tienePagosRegistrados,
      motivoBloqueoEdicion: estadoEdicion.tienePagosRegistrados
        ? MENSAJE_PAGOS_REGISTRADOS
        : estadoEdicion.tieneCuotasGeneradas
          ? MENSAJE_CUOTAS_GENERADAS
          : null,
    };
  }

  private obtenerEstadoEdicion(prestamo: Prestamo): {
    tieneCuotasGeneradas: boolean;
    tienePagosRegistrados: boolean;
  } {
    const cuotas = prestamo.cuotas ?? [];

    return {
      tieneCuotasGeneradas: cuotas.length > 0,
      tienePagosRegistrados: cuotas.some((cuota) => cuota.pagos?.length > 0),
    };
  }

  private toMoney(value: number | string): number {
    return Number(Number(value).toFixed(2));
  }

  private async findClienteById(
    id: number,
    manager?: EntityManager,
  ): Promise<Cliente> {
    const cliente = manager
      ? await manager.getRepository(Cliente).findOne({ where: { id } })
      : await this.clienteRepository.findById(id);

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }

  private async generarCuotas(
    prestamo: Prestamo,
    fechaPrimerVencimiento?: string,
    manager?: EntityManager,
  ): Promise<Cuota[]> {
    const cuotaRepository = manager?.getRepository(Cuota);
    const numeroCuotas = prestamo.numeroCuotas;
    const montoPrestamo = Number(prestamo.monto);
    const montoBase = Number((montoPrestamo / numeroCuotas).toFixed(2));
    const primeraFecha =
      fechaPrimerVencimiento ?? this.addMonths(prestamo.fechaInicio, 1);
    const cuotas: Cuota[] = [];
    let totalAsignado = 0;

    for (let index = 0; index < numeroCuotas; index += 1) {
      const isLast = index === numeroCuotas - 1;
      const monto = isLast
        ? Number((montoPrestamo - totalAsignado).toFixed(2))
        : montoBase;

      totalAsignado = Number((totalAsignado + monto).toFixed(2));

      const cuotaData = {
        numeroCuota: index + 1,
        fechaVencimiento: this.addMonths(primeraFecha, index),
        monto,
        saldoPendiente: monto,
        estado: 'PENDIENTE' as const,
        prestamo,
        prestamoId: prestamo.id,
      };
      const cuota = cuotaRepository
        ? cuotaRepository.create(cuotaData)
        : this.cuotaRepository.create(cuotaData, prestamo);

      cuotas.push(
        cuotaRepository
          ? await cuotaRepository.save(cuota)
          : await this.cuotaRepository.save(cuota),
      );
    }

    return cuotas;
  }

  private addMonths(date: string, months: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    parsedDate.setUTCMonth(parsedDate.getUTCMonth() + months);

    return parsedDate.toISOString().slice(0, 10);
  }
}
