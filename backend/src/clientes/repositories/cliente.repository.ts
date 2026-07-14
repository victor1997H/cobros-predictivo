import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateClienteDto } from '../dto/create-cliente.dto';
import { UpdateClienteDto } from '../dto/update-cliente.dto';
import { Cliente } from '../entities/cliente.entity';

@Injectable()
export class ClienteRepository {
  constructor(
    @InjectRepository(Cliente)
    private readonly repository: Repository<Cliente>,
  ) {}

  findAll(): Promise<Cliente[]> {
    return this.repository.find({
      order: {
        id: 'DESC',
      },
    });
  }

  findById(id: number): Promise<Cliente | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  findByIdentificacion(identificacion: string): Promise<Cliente | null> {
    return this.repository.findOne({
      where: { identificacion },
    });
  }

  findByEmail(email: string): Promise<Cliente | null> {
    return this.repository.findOne({
      where: { email },
    });
  }

  create(data: CreateClienteDto): Cliente {
    return this.repository.create({
      ...data,
      direccion: data.direccion ?? null,
      estado: data.estado ?? true,
    });
  }

  merge(cliente: Cliente, data: UpdateClienteDto): Cliente {
    return this.repository.merge(cliente, {
      ...data,
      direccion:
        data.direccion === undefined ? cliente.direccion : data.direccion,
    });
  }

  save(cliente: Cliente): Promise<Cliente> {
    return this.repository.save(cliente);
  }

  async delete(cliente: Cliente): Promise<void> {
    await this.repository.remove(cliente);
  }
}
