import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prestamo } from '../prestamos/entities/prestamo.entity';
import { PrestamoRepository } from '../prestamos/repositories/prestamo.repository';
import { CreateCuotaDto } from './dto/create-cuota.dto';
import { UpdateCuotaDto } from './dto/update-cuota.dto';
import { Cuota } from './entities/cuota.entity';
import { CuotaRepository } from './repositories/cuota.repository';
import { clasificarRiesgo, NivelRiesgo } from './riesgo/nivel-riesgo';

const TIMEZONE = 'America/Guayaquil';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CuotaResponse {
  success: boolean;
  message: string;
  cuota: Cuota;
}

export interface CuotasResponse {
  success: boolean;
  message: string;
  cuotas: Cuota[];
}

export interface CuotaGestionCobranza {
  cuota: {
    id: number;
    numeroCuota: number;
    fechaVencimiento: string;
    monto: number;
    saldoPendiente: number;
    estado: string;
  };
  prestamo: {
    id: number;
    monto: number;
    fechaInicio: string;
    numeroCuotas: number;
    estado: string;
  };
  cliente: {
    id: number;
    identificacion: string;
    nombres: string;
    apellidos: string;
    email: string;
    telefono: string;
  };
  tipoGestion: 'VENCE_MANANA' | 'VENCIDA';
  diasAtraso: number;
  nivelRiesgo: NivelRiesgo;
  saldoPendientePrestamo: number;
}

export interface GestionCobranzaResponse {
  success: boolean;
  message: string;
  fechaReferencia: string;
  fechaManana: string;
  cuotas: CuotaGestionCobranza[];
}

export interface CuotaPendientePago {
  cuotaId: number;
  prestamoId: number;
  cliente: {
    id: number;
    identificacion: string;
    nombres: string;
    apellidos: string;
    email: string;
    telefono: string;
  };
  numeroCuota: number;
  fechaVencimiento: string;
  montoCuota: number;
  saldoPendiente: number;
  estado: string;
  totalPagadoCuota: number;
  saldoPendientePrestamo: number;
}

export interface CuotasPendientesPagoResponse {
  success: boolean;
  message: string;
  cuotas: CuotaPendientePago[];
}

@Injectable()
export class CuotasService {
  constructor(
    private readonly cuotaRepository: CuotaRepository,
    private readonly prestamoRepository: PrestamoRepository,
  ) {}

  async findAll(): Promise<CuotasResponse> {
    const cuotas = await this.cuotaRepository.findAll();

    return {
      success: true,
      message: 'Cuotas obtenidas correctamente',
      cuotas,
    };
  }

  async findOne(id: number): Promise<CuotaResponse> {
    const cuota = await this.findCuotaById(id);

    return {
      success: true,
      message: 'Cuota obtenida correctamente',
      cuota,
    };
  }

  async findGestionCobranza(): Promise<GestionCobranzaResponse> {
    const today = this.getDateInTimezone(new Date(), TIMEZONE);
    const tomorrow = this.addDays(today, 1);
    const cuotas = await this.cuotaRepository.findForGestionCobranza(
      today,
      tomorrow,
    );
    const saldoPorPrestamo =
      await this.cuotaRepository.calcularSaldoPendientePorPrestamos(
        this.obtenerPrestamoIds(cuotas),
      );

    return {
      success: true,
      message: 'Cuotas para gestion de cobranza obtenidas correctamente',
      fechaReferencia: today,
      fechaManana: tomorrow,
      cuotas: cuotas.map((cuota) =>
        this.toGestionCobranzaItem(cuota, today, tomorrow, saldoPorPrestamo),
      ),
    };
  }

  async findPendientesParaPago(): Promise<CuotasPendientesPagoResponse> {
    const cuotas = (await this.cuotaRepository.findPendientesParaPago()).filter(
      (cuota) => this.esCuotaDisponibleParaPago(cuota),
    );
    const saldoPorPrestamo = this.calcularSaldoPendientePorPrestamo(cuotas);

    return {
      success: true,
      message: 'Cuotas pendientes para pago obtenidas correctamente',
      cuotas: cuotas.map((cuota) =>
        this.toPendientePagoItem(cuota, saldoPorPrestamo),
      ),
    };
  }

  async create(data: CreateCuotaDto): Promise<CuotaResponse> {
    this.validateSaldoPendiente(data.monto, data.saldoPendiente);

    const { prestamoId, ...cuotaData } = data;
    const prestamo = await this.findPrestamoById(prestamoId);
    const cuota = this.cuotaRepository.create(cuotaData, prestamo);
    const savedCuota = await this.cuotaRepository.save(cuota);

    return {
      success: true,
      message: 'Cuota creada correctamente',
      cuota: savedCuota,
    };
  }

  async update(id: number, data: UpdateCuotaDto): Promise<CuotaResponse> {
    const cuota = await this.findCuotaById(id);
    const { prestamoId, ...cuotaData } = data;
    const prestamo =
      prestamoId === undefined
        ? undefined
        : await this.findPrestamoById(prestamoId);

    const monto = cuotaData.monto ?? Number(cuota.monto);
    const saldoPendiente =
      cuotaData.saldoPendiente ?? Number(cuota.saldoPendiente);
    this.validateSaldoPendiente(monto, saldoPendiente);

    const updatedCuota = this.cuotaRepository.merge(cuota, cuotaData, prestamo);
    const savedCuota = await this.cuotaRepository.save(updatedCuota);

    return {
      success: true,
      message: 'Cuota actualizada correctamente',
      cuota: savedCuota,
    };
  }

  async remove(id: number): Promise<{ success: boolean; message: string }> {
    const cuota = await this.findCuotaById(id);

    await this.cuotaRepository.delete(cuota);

    return {
      success: true,
      message: 'Cuota eliminada correctamente',
    };
  }

  private async findCuotaById(id: number): Promise<Cuota> {
    const cuota = await this.cuotaRepository.findById(id);

    if (!cuota) {
      throw new NotFoundException('Cuota no encontrada');
    }

    return cuota;
  }

  private async findPrestamoById(id: number): Promise<Prestamo> {
    const prestamo = await this.prestamoRepository.findById(id);

    if (!prestamo) {
      throw new NotFoundException('Prestamo no encontrado');
    }

    return prestamo;
  }

  private validateSaldoPendiente(monto: number, saldoPendiente: number): void {
    if (saldoPendiente > monto) {
      throw new BadRequestException(
        'El saldo pendiente no puede ser mayor al monto de la cuota',
      );
    }
  }

  private toGestionCobranzaItem(
    cuota: Cuota,
    today: string,
    tomorrow: string,
    saldoPorPrestamo: Map<number, number>,
  ): CuotaGestionCobranza {
    const diasAtraso = this.calculateDiasAtraso(cuota.fechaVencimiento, today);

    return {
      cuota: {
        id: cuota.id,
        numeroCuota: cuota.numeroCuota,
        fechaVencimiento: cuota.fechaVencimiento,
        monto: Number(cuota.monto),
        saldoPendiente: Number(cuota.saldoPendiente),
        estado: cuota.estado,
      },
      prestamo: {
        id: cuota.prestamo.id,
        monto: Number(cuota.prestamo.monto),
        fechaInicio: cuota.prestamo.fechaInicio,
        numeroCuotas: cuota.prestamo.numeroCuotas,
        estado: cuota.prestamo.estado,
      },
      cliente: {
        id: cuota.prestamo.cliente.id,
        identificacion: cuota.prestamo.cliente.identificacion,
        nombres: cuota.prestamo.cliente.nombres,
        apellidos: cuota.prestamo.cliente.apellidos,
        email: cuota.prestamo.cliente.email,
        telefono: cuota.prestamo.cliente.telefono,
      },
      tipoGestion:
        cuota.fechaVencimiento === tomorrow ? 'VENCE_MANANA' : 'VENCIDA',
      diasAtraso,
      nivelRiesgo: clasificarRiesgo(diasAtraso),
      saldoPendientePrestamo: saldoPorPrestamo.get(cuota.prestamoId) ?? 0,
    };
  }

  private obtenerPrestamoIds(cuotas: Cuota[]): number[] {
    return Array.from(new Set(cuotas.map((cuota) => cuota.prestamoId)));
  }

  private esCuotaDisponibleParaPago(cuota: Cuota): boolean {
    return (
      ['PENDIENTE', 'VENCIDA'].includes(cuota.estado) &&
      Number(cuota.saldoPendiente) > 0
    );
  }

  private toPendientePagoItem(
    cuota: Cuota,
    saldoPorPrestamo: Map<number, number>,
  ): CuotaPendientePago {
    const montoCuota = Number(cuota.monto);
    const saldoPendiente = Number(cuota.saldoPendiente);
    const cliente = cuota.prestamo.cliente;

    return {
      cuotaId: cuota.id,
      prestamoId: cuota.prestamoId,
      cliente: {
        id: cliente.id,
        identificacion: cliente.identificacion,
        nombres: cliente.nombres,
        apellidos: cliente.apellidos,
        email: cliente.email,
        telefono: cliente.telefono,
      },
      numeroCuota: cuota.numeroCuota,
      fechaVencimiento: cuota.fechaVencimiento,
      montoCuota,
      saldoPendiente,
      estado: cuota.estado,
      totalPagadoCuota: Number((montoCuota - saldoPendiente).toFixed(2)),
      saldoPendientePrestamo: saldoPorPrestamo.get(cuota.prestamoId) ?? 0,
    };
  }

  private calcularSaldoPendientePorPrestamo(
    cuotas: Cuota[],
  ): Map<number, number> {
    return cuotas.reduce((totales, cuota) => {
      const saldoActual = totales.get(cuota.prestamoId) ?? 0;
      const saldoNuevo = Number(
        (saldoActual + Number(cuota.saldoPendiente)).toFixed(2),
      );

      totales.set(cuota.prestamoId, saldoNuevo);

      return totales;
    }, new Map<number, number>());
  }

  private calculateDiasAtraso(fechaVencimiento: string, today: string): number {
    const vencimiento = this.parseDateOnly(fechaVencimiento).getTime();
    const referencia = this.parseDateOnly(today).getTime();
    const diff = Math.floor((referencia - vencimiento) / MILLISECONDS_PER_DAY);

    return Math.max(diff, 0);
  }

  private getDateInTimezone(date: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new Error('No se pudo calcular la fecha actual');
    }

    return `${year}-${month}-${day}`;
  }

  private addDays(date: string, days: number): string {
    const parsedDate = this.parseDateOnly(date);
    parsedDate.setUTCDate(parsedDate.getUTCDate() + days);

    return parsedDate.toISOString().slice(0, 10);
  }

  private parseDateOnly(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day));
  }
}
