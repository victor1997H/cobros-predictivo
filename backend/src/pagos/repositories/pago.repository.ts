import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Cuota } from '../../cuotas/entities/cuota.entity';
import { CreatePagoDto } from '../dto/create-pago.dto';
import { Pago } from '../entities/pago.entity';

type CreatePagoData = Omit<CreatePagoDto, 'cuotaId'>;

@Injectable()
export class PagoRepository {
  constructor(
    @InjectRepository(Pago)
    private readonly repository: Repository<Pago>,
  ) {}

  findAll(): Promise<Pago[]> {
    return this.repository.find({
      relations: {
        cuota: {
          prestamo: {
            cliente: true,
          },
        },
      },
      order: {
        id: 'DESC',
      },
    });
  }

  findById(id: number): Promise<Pago | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        cuota: {
          prestamo: {
            cliente: true,
          },
        },
      },
    });
  }

  create(data: CreatePagoData, cuota: Cuota): Pago {
    return this.repository.create({
      ...data,
      metodoPago: data.metodoPago ?? 'EFECTIVO',
      referencia: data.referencia?.trim() || null,
      observacion: data.observacion?.trim() || null,
      cuota,
      cuotaId: cuota.id,
    });
  }

  save(pago: Pago): Promise<Pago> {
    return this.repository.save(pago);
  }
}
