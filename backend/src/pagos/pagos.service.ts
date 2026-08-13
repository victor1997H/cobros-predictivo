import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Cuota } from '../cuotas/entities/cuota.entity';
import { CuotaRepository } from '../cuotas/repositories/cuota.repository';
import { CreatePagoDto } from './dto/create-pago.dto';
import { Pago } from './entities/pago.entity';
import { PagoRepository } from './repositories/pago.repository';

const TIMEZONE = 'America/Guayaquil';

export interface PagoDetalle {
  pago: {
    id: number;
    fechaPago: string;
    monto: number;
    metodoPago: string;
    referencia: string | null;
    observacion: string | null;
    createdAt: Date;
  };
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
}

export interface PagosResponse {
  success: boolean;
  message: string;
  pagos: PagoDetalle[];
}

export interface PagoResponse {
  success: boolean;
  message: string;
  pago: PagoDetalle;
}

@Injectable()
export class PagosService {
  constructor(
    private readonly pagoRepository: PagoRepository,
    private readonly cuotaRepository: CuotaRepository,
  ) {}

  async findAll(): Promise<PagosResponse> {
    const pagos = await this.pagoRepository.findAll();

    return {
      success: true,
      message: 'Pagos obtenidos correctamente',
      pagos: pagos.map((pago) => this.toPagoDetalle(pago)),
    };
  }

  async create(data: CreatePagoDto): Promise<PagoResponse> {
    const cuota = await this.findCuotaById(data.cuotaId);
    const saldoActual = Number(cuota.saldoPendiente);
    const monto = Number(data.monto);

    if (saldoActual <= 0 || cuota.estado === 'PAGADA') {
      throw new BadRequestException('La cuota ya se encuentra pagada');
    }

    if (monto > saldoActual) {
      throw new BadRequestException(
        'El monto del pago no puede superar el saldo pendiente',
      );
    }

    const fechaPago = data.fechaPago ?? this.getDateInTimezone(new Date());
    const pago = this.pagoRepository.create(
      {
        ...data,
        monto,
        fechaPago,
      },
      cuota,
    );
    const savedPago = await this.pagoRepository.save(pago);

    cuota.saldoPendiente = Number((saldoActual - monto).toFixed(2));

    if (cuota.saldoPendiente === 0) {
      cuota.estado = 'PAGADA';
    }

    await this.cuotaRepository.save(cuota);

    const pagoConRelaciones = await this.pagoRepository.findById(savedPago.id);

    if (!pagoConRelaciones) {
      throw new NotFoundException('Pago no encontrado despues de guardarlo');
    }

    return {
      success: true,
      message: 'Pago registrado correctamente',
      pago: this.toPagoDetalle(pagoConRelaciones),
    };
  }

  private async findCuotaById(id: number): Promise<Cuota> {
    const cuota = await this.cuotaRepository.findById(id);

    if (!cuota) {
      throw new NotFoundException('Cuota no encontrada');
    }

    return cuota;
  }

  private toPagoDetalle(pago: Pago): PagoDetalle {
    const cuota = pago.cuota;
    const prestamo = cuota.prestamo;
    const cliente = prestamo.cliente;

    return {
      pago: {
        id: pago.id,
        fechaPago: pago.fechaPago,
        monto: Number(pago.monto),
        metodoPago: pago.metodoPago,
        referencia: pago.referencia,
        observacion: pago.observacion,
        createdAt: pago.createdAt,
      },
      cuota: {
        id: cuota.id,
        numeroCuota: cuota.numeroCuota,
        fechaVencimiento: cuota.fechaVencimiento,
        monto: Number(cuota.monto),
        saldoPendiente: Number(cuota.saldoPendiente),
        estado: cuota.estado,
      },
      prestamo: {
        id: prestamo.id,
        monto: Number(prestamo.monto),
        fechaInicio: prestamo.fechaInicio,
        numeroCuotas: prestamo.numeroCuotas,
        estado: prestamo.estado,
      },
      cliente: {
        id: cliente.id,
        identificacion: cliente.identificacion,
        nombres: cliente.nombres,
        apellidos: cliente.apellidos,
        email: cliente.email,
        telefono: cliente.telefono,
      },
    };
  }

  private getDateInTimezone(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new Error('No se pudo calcular la fecha de pago');
    }

    return `${year}-${month}-${day}`;
  }
}
