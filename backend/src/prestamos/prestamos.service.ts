import { Injectable, NotFoundException } from '@nestjs/common';

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
  prestamo: Prestamo;
  cuotasGeneradas?: Cuota[];
}

export interface PrestamosResponse {
  success: boolean;
  message: string;
  prestamos: Prestamo[];
}

@Injectable()
export class PrestamosService {
  constructor(
    private readonly prestamoRepository: PrestamoRepository,
    private readonly clienteRepository: ClienteRepository,
    private readonly cuotaRepository: CuotaRepository,
  ) {}

  async findAll(): Promise<PrestamosResponse> {
    const prestamos = await this.prestamoRepository.findAll();

    return {
      success: true,
      message: 'Prestamos obtenidos correctamente',
      prestamos,
    };
  }

  async findOne(id: number): Promise<PrestamoResponse> {
    const prestamo = await this.findPrestamoById(id);

    return {
      success: true,
      message: 'Prestamo obtenido correctamente',
      prestamo,
    };
  }

  async create(data: CreatePrestamoDto): Promise<PrestamoResponse> {
    const {
      clienteId,
      generarCuotas,
      fechaPrimerVencimiento,
      ...prestamoData
    } = data;
    const cliente = await this.findClienteById(clienteId);
    const prestamo = this.prestamoRepository.create(prestamoData, cliente);
    const savedPrestamo = await this.prestamoRepository.save(prestamo);
    const cuotasGeneradas = generarCuotas
      ? await this.generarCuotas(savedPrestamo, fechaPrimerVencimiento)
      : [];

    return {
      success: true,
      message:
        cuotasGeneradas.length > 0
          ? 'Prestamo creado correctamente con cuotas generadas'
          : 'Prestamo creado correctamente',
      prestamo: savedPrestamo,
      cuotasGeneradas,
    };
  }

  async update(id: number, data: UpdatePrestamoDto): Promise<PrestamoResponse> {
    const prestamo = await this.findPrestamoById(id);
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
      prestamo: savedPrestamo,
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

  private async findClienteById(id: number): Promise<Cliente> {
    const cliente = await this.clienteRepository.findById(id);

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }

  private async generarCuotas(
    prestamo: Prestamo,
    fechaPrimerVencimiento?: string,
  ): Promise<Cuota[]> {
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

      const cuota = this.cuotaRepository.create(
        {
          numeroCuota: index + 1,
          fechaVencimiento: this.addMonths(primeraFecha, index),
          monto,
          saldoPendiente: monto,
          estado: 'PENDIENTE',
        },
        prestamo,
      );

      cuotas.push(await this.cuotaRepository.save(cuota));
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
