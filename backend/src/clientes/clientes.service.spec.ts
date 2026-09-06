import { BadRequestException } from '@nestjs/common';

import { ClientesService } from './clientes.service';
import { Cliente } from './entities/cliente.entity';
import { ClienteRepository } from './repositories/cliente.repository';

describe('ClientesService', () => {
  let service: ClientesService;
  let repository: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findByIdentificacion: jest.Mock;
    findByEmail: jest.Mock;
    create: jest.Mock;
    merge: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  const clienteBase: Cliente = {
    id: 1,
    nombres: 'Cliente',
    apellidos: 'Prueba',
    identificacion: '1726494899',
    email: 'cliente@example.com',
    telefono: '+593987545679',
    direccion: null,
    estado: true,
    prestamos: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdentificacion: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn((data: Partial<Cliente>): Cliente => ({
        ...clienteBase,
        ...data,
      })),
      merge: jest.fn((cliente: Cliente, data: Partial<Cliente>): Cliente => ({
        ...cliente,
        ...data,
      })),
      save: jest.fn((cliente: Cliente) => Promise.resolve(cliente)),
      delete: jest.fn(),
    };

    service = new ClientesService(repository as unknown as ClienteRepository);
  });

  it('normaliza el telefono antes de crear el cliente', async () => {
    repository.findByIdentificacion.mockResolvedValue(null);
    repository.findByEmail.mockResolvedValue(null);

    const response = await service.create({
      nombres: 'Cliente',
      apellidos: 'Prueba',
      identificacion: '1726494899',
      email: 'cliente@example.com',
      telefono: '0987545679',
      direccion: null,
      estado: true,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        telefono: '+593987545679',
      }),
    );
    expect(response.cliente.telefono).toBe('+593987545679');
  });

  it('normaliza el telefono antes de actualizar el cliente', async () => {
    repository.findById.mockResolvedValue(clienteBase);

    const response = await service.update(1, {
      telefono: '+593 98 754 5679',
    });

    expect(repository.merge).toHaveBeenCalledWith(
      clienteBase,
      expect.objectContaining({
        telefono: '+593987545679',
      }),
    );
    expect(response.cliente.telefono).toBe('+593987545679');
  });

  it('rechaza telefonos invalidos antes de persistir', async () => {
    repository.findByIdentificacion.mockResolvedValue(null);
    repository.findByEmail.mockResolvedValue(null);

    await expect(
      service.create({
        nombres: 'Cliente',
        apellidos: 'Prueba',
        identificacion: '1726494899',
        email: 'cliente@example.com',
        telefono: 'abc123',
        direccion: null,
        estado: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
