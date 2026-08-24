import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { Cliente } from '../clientes/entities/cliente.entity';
import { ClienteRepository } from '../clientes/repositories/cliente.repository';
import { Cuota } from '../cuotas/entities/cuota.entity';
import { CuotaRepository } from '../cuotas/repositories/cuota.repository';
import { Prestamo } from './entities/prestamo.entity';
import { PrestamosService } from './prestamos.service';
import { PrestamoRepository } from './repositories/prestamo.repository';

describe('PrestamosService', () => {
  let service: PrestamosService;
  let dataSource: { transaction: jest.Mock };
  let clienteTransactionalRepository: { findOne: jest.Mock };
  let prestamoTransactionalRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let cuotaTransactionalRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let rollbackDetectado: boolean;

  const cliente = {
    id: 1,
    nombres: 'Cliente',
    apellidos: 'Prueba',
    identificacion: 'TEST-001',
    email: 'cliente@example.com',
    telefono: '0999999999',
    direccion: null,
    estado: true,
    prestamos: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Cliente;

  beforeEach(() => {
    rollbackDetectado = false;
    clienteTransactionalRepository = {
      findOne: jest.fn().mockResolvedValue(cliente),
    };
    prestamoTransactionalRepository = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (prestamo) => ({
        ...prestamo,
        id: 10,
      })),
    };
    cuotaTransactionalRepository = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (cuota) => ({
        ...cuota,
        id: cuota.numeroCuota,
      })),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Cliente) {
          return clienteTransactionalRepository;
        }

        if (entity === Prestamo) {
          return prestamoTransactionalRepository;
        }

        if (entity === Cuota) {
          return cuotaTransactionalRepository;
        }

        throw new Error('Repositorio no simulado');
      }),
    } as unknown as EntityManager;

    dataSource = {
      transaction: jest.fn(async (callback) => {
        try {
          return await callback(manager);
        } catch (error) {
          rollbackDetectado = true;
          throw error;
        }
      }),
    };

    service = new PrestamosService(
      {} as PrestamoRepository,
      {} as ClienteRepository,
      {} as CuotaRepository,
      dataSource as unknown as DataSource,
    );
  });

  it('crea prestamo valido y genera cuotas dentro de una transaccion', async () => {
    const response = await service.create({
      clienteId: 1,
      monto: 2000,
      fechaInicio: '2026-01-01',
      numeroCuotas: 3,
      generarCuotas: true,
      fechaPrimerVencimiento: '2026-02-01',
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(response.success).toBe(true);
    expect(response.prestamo.id).toBe(10);
    expect(response.cuotasGeneradas).toHaveLength(3);

    const totalCuotas = response.cuotasGeneradas!.reduce(
      (total, cuota) => Number((total + Number(cuota.monto)).toFixed(2)),
      0,
    );

    expect(totalCuotas).toBe(2000);
    expect(response.cuotasGeneradas!.map((cuota) => cuota.monto)).toEqual([
      666.67, 666.67, 666.66,
    ]);
  });

  it('propaga errores de cuotas para permitir rollback completo', async () => {
    cuotaTransactionalRepository.save.mockRejectedValueOnce(
      new Error('fallo controlado al guardar cuota'),
    );

    await expect(
      service.create({
        clienteId: 1,
        monto: 500,
        fechaInicio: '2026-01-01',
        numeroCuotas: 2,
        generarCuotas: true,
      }),
    ).rejects.toThrow('fallo controlado al guardar cuota');

    expect(prestamoTransactionalRepository.save).toHaveBeenCalledTimes(1);
    expect(cuotaTransactionalRepository.save).toHaveBeenCalledTimes(1);
    expect(rollbackDetectado).toBe(true);
  });

  it('rechaza la creacion si el cliente no existe dentro de la transaccion', async () => {
    clienteTransactionalRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create({
        clienteId: 999,
        monto: 500,
        fechaInicio: '2026-01-01',
        numeroCuotas: 2,
        generarCuotas: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prestamoTransactionalRepository.save).not.toHaveBeenCalled();
    expect(rollbackDetectado).toBe(true);
  });
});
