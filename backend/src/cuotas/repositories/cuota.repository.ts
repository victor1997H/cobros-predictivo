import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, In, LessThan, MoreThan, Repository } from 'typeorm';

import { Prestamo } from '../../prestamos/entities/prestamo.entity';
import { CreateCuotaDto } from '../dto/create-cuota.dto';
import { UpdateCuotaDto } from '../dto/update-cuota.dto';
import { Cuota } from '../entities/cuota.entity';

type CreateCuotaData = Omit<CreateCuotaDto, 'prestamoId'>;
type UpdateCuotaData = Omit<UpdateCuotaDto, 'prestamoId'>;

@Injectable()
export class CuotaRepository {
  constructor(
    @InjectRepository(Cuota)
    private readonly repository: Repository<Cuota>,
  ) {}

  findAll(): Promise<Cuota[]> {
    return this.repository.find({
      relations: {
        prestamo: {
          cliente: true,
        },
      },
      order: {
        id: 'DESC',
      },
    });
  }

  findById(id: number): Promise<Cuota | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        prestamo: {
          cliente: true,
        },
      },
    });
  }

  findForGestionCobranza(today: string, tomorrow: string): Promise<Cuota[]> {
    return this.repository.find({
      where: [
        {
          estado: In(['PENDIENTE', 'VENCIDA']),
          fechaVencimiento: LessThan(today),
        },
        {
          estado: 'PENDIENTE',
          fechaVencimiento: Equal(tomorrow),
        },
      ],
      relations: {
        prestamo: {
          cliente: true,
        },
      },
      order: {
        fechaVencimiento: 'ASC',
        numeroCuota: 'ASC',
      },
    });
  }

  findPendientesParaPago(): Promise<Cuota[]> {
    return this.repository.find({
      where: {
        estado: In(['PENDIENTE', 'VENCIDA']),
        saldoPendiente: MoreThan(0),
      },
      relations: {
        prestamo: {
          cliente: true,
        },
      },
      order: {
        fechaVencimiento: 'ASC',
        numeroCuota: 'ASC',
      },
    });
  }

  create(data: CreateCuotaData, prestamo: Prestamo): Cuota {
    return this.repository.create({
      ...data,
      estado: data.estado ?? 'PENDIENTE',
      prestamo,
      prestamoId: prestamo.id,
    });
  }

  merge(cuota: Cuota, data: UpdateCuotaData, prestamo?: Prestamo): Cuota {
    const updatedCuota = this.repository.merge(cuota, data);

    if (prestamo) {
      updatedCuota.prestamo = prestamo;
      updatedCuota.prestamoId = prestamo.id;
    }

    return updatedCuota;
  }

  save(cuota: Cuota): Promise<Cuota> {
    return this.repository.save(cuota);
  }

  async delete(cuota: Cuota): Promise<void> {
    await this.repository.remove(cuota);
  }
}
