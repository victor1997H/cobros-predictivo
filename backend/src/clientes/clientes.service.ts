import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { Cliente } from './entities/cliente.entity';
import { ClienteRepository } from './repositories/cliente.repository';

export interface ClienteResponse {
  success: boolean;
  message: string;
  cliente: Cliente;
}

export interface ClientesResponse {
  success: boolean;
  message: string;
  clientes: Cliente[];
}

@Injectable()
export class ClientesService {
  constructor(private readonly clienteRepository: ClienteRepository) {}

  async findAll(): Promise<ClientesResponse> {
    const clientes = await this.clienteRepository.findAll();

    return {
      success: true,
      message: 'Clientes obtenidos correctamente',
      clientes,
    };
  }

  async findOne(id: number): Promise<ClienteResponse> {
    const cliente = await this.findClienteById(id);

    return {
      success: true,
      message: 'Cliente obtenido correctamente',
      cliente,
    };
  }

  async create(data: CreateClienteDto): Promise<ClienteResponse> {
    await this.validateUniqueFields(data.identificacion, data.email);

    try {
      const cliente = this.clienteRepository.create(data);
      const savedCliente = await this.clienteRepository.save(cliente);

      return {
        success: true,
        message: 'Cliente creado correctamente',
        cliente: savedCliente,
      };
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(id: number, data: UpdateClienteDto): Promise<ClienteResponse> {
    const cliente = await this.findClienteById(id);

    if (data.identificacion && data.identificacion !== cliente.identificacion) {
      const existingByIdentificacion =
        await this.clienteRepository.findByIdentificacion(data.identificacion);

      if (existingByIdentificacion) {
        throw new ConflictException('La identificacion ya esta registrada');
      }
    }

    if (data.email && data.email !== cliente.email) {
      const existingByEmail = await this.clienteRepository.findByEmail(
        data.email,
      );

      if (existingByEmail) {
        throw new ConflictException('El email ya esta registrado');
      }
    }

    try {
      const updatedCliente = this.clienteRepository.merge(cliente, data);
      const savedCliente = await this.clienteRepository.save(updatedCliente);

      return {
        success: true,
        message: 'Cliente actualizado correctamente',
        cliente: savedCliente,
      };
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async remove(id: number): Promise<{ success: boolean; message: string }> {
    const cliente = await this.findClienteById(id);

    await this.clienteRepository.delete(cliente);

    return {
      success: true,
      message: 'Cliente eliminado correctamente',
    };
  }

  private async validateUniqueFields(
    identificacion: string,
    email: string,
  ): Promise<void> {
    const existingByIdentificacion =
      await this.clienteRepository.findByIdentificacion(identificacion);

    if (existingByIdentificacion) {
      throw new ConflictException('La identificacion ya esta registrada');
    }

    const existingByEmail = await this.clienteRepository.findByEmail(email);

    if (existingByEmail) {
      throw new ConflictException('El email ya esta registrado');
    }
  }

  private async findClienteById(id: number): Promise<Cliente> {
    const cliente = await this.clienteRepository.findById(id);

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }

  private handlePersistenceError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new ConflictException('Ya existe un cliente con esos datos');
    }

    throw error;
  }
}
