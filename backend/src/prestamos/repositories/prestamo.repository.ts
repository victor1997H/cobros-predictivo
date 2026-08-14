import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Cliente } from '../../clientes/entities/cliente.entity';
import { CreatePrestamoDto } from '../dto/create-prestamo.dto';
import { UpdatePrestamoDto } from '../dto/update-prestamo.dto';
import { Prestamo } from '../entities/prestamo.entity';

type CreatePrestamoData = Omit<
  CreatePrestamoDto,
  'clienteId' | 'generarCuotas' | 'fechaPrimerVencimiento'
>;
type UpdatePrestamoData = Omit<UpdatePrestamoDto, 'clienteId'>;

@Injectable()
export class PrestamoRepository {
  constructor(
    @InjectRepository(Prestamo)
    private readonly repository: Repository<Prestamo>,
  ) {}

  findAll(): Promise<Prestamo[]> {
    return this.repository.find({
      relations: {
        cliente: true,
      },
      order: {
        id: 'DESC',
      },
    });
  }

  findById(id: number): Promise<Prestamo | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        cliente: true,
      },
    });
  }

  create(data: CreatePrestamoData, cliente: Cliente): Prestamo {
    return this.repository.create({
      ...data,
      estado: data.estado ?? 'ACTIVO',
      cliente,
      clienteId: cliente.id,
    });
  }

  merge(
    prestamo: Prestamo,
    data: UpdatePrestamoData,
    cliente?: Cliente,
  ): Prestamo {
    const updatedPrestamo = this.repository.merge(prestamo, data);

    if (cliente) {
      updatedPrestamo.cliente = cliente;
      updatedPrestamo.clienteId = cliente.id;
    }

    return updatedPrestamo;
  }

  save(prestamo: Prestamo): Promise<Prestamo> {
    return this.repository.save(prestamo);
  }

  async delete(prestamo: Prestamo): Promise<void> {
    await this.repository.remove(prestamo);
  }
}
