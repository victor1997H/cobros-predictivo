/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { Cliente } from '../clientes/entities/cliente.entity';
import { ClienteRepository } from '../clientes/repositories/cliente.repository';
import { Cuota } from '../cuotas/entities/cuota.entity';
import { CuotaRepository } from '../cuotas/repositories/cuota.repository';
import { Pago } from '../pagos/entities/pago.entity';
import { Prestamo } from './entities/prestamo.entity';
import { PrestamosService } from './prestamos.service';
import { PrestamoRepository } from './repositories/prestamo.repository';

describe('PrestamosService', () => {
  let service: PrestamosService;
  let dataSource: { transaction: jest.Mock };
  let prestamoRepository: {
    findById: jest.Mock;
    merge: jest.Mock;
    save: jest.Mock;
  };
  let clienteRepository: { findById: jest.Mock };
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

  const clienteActualizado = {
    ...cliente,
    id: 2,
    identificacion: 'TEST-002',
    email: 'cliente2@example.com',
  };

  const crearPrestamo = (overrides: Partial<Prestamo> = {}) => ({
    id: 10,
    clienteId: cliente.id,
    cliente,
    monto: 1000,
    fechaInicio: '2026-01-01',
    numeroCuotas: 2,
    estado: 'ACTIVO',
    cuotas: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const crearCuota = (overrides: Partial<Cuota> = {}) =>
    ({
      id: 20,
      prestamoId: 10,
      numeroCuota: 1,
      fechaVencimiento: '2026-02-01',
      monto: 500,
      saldoPendiente: 500,
      estado: 'PENDIENTE',
      pagos: [],
      gestionesCobranza: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Cuota;

  const crearPago = (overrides: Partial<Pago> = {}) =>
    ({
      id: 30,
      cuotaId: 20,
      fechaPago: '2026-02-01',
      monto: 100,
      metodoPago: 'EFECTIVO',
      referencia: null,
      observacion: null,
      createdAt: new Date(),
      ...overrides,
    }) as Pago;

  beforeEach(() => {
    rollbackDetectado = false;
    prestamoRepository = {
      findById: jest.fn(),
      merge: jest.fn((prestamo, data, clienteParam?: Cliente) => ({
        ...prestamo,
        ...data,
        ...(clienteParam
          ? { cliente: clienteParam, clienteId: clienteParam.id }
          : {}),
      })),
      save: jest.fn(async (prestamo) => prestamo),
    };
    clienteRepository = {
      findById: jest.fn().mockResolvedValue(clienteActualizado),
    };
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
      prestamoRepository as unknown as PrestamoRepository,
      clienteRepository as unknown as ClienteRepository,
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

  it('permite editar condiciones financieras cuando el prestamo no tiene cuotas', async () => {
    prestamoRepository.findById.mockResolvedValueOnce(crearPrestamo());

    const response = await service.update(10, {
      clienteId: clienteActualizado.id,
      monto: 1200,
      fechaInicio: '2026-03-01',
      numeroCuotas: 4,
      estado: 'REFINANCIADO',
    });

    expect(clienteRepository.findById).toHaveBeenCalledWith(
      clienteActualizado.id,
    );
    expect(prestamoRepository.save).toHaveBeenCalledTimes(1);
    expect(response.prestamo.clienteId).toBe(clienteActualizado.id);
    expect(response.prestamo.monto).toBe(1200);
    expect(response.prestamo.numeroCuotas).toBe(4);
    expect(response.prestamo.puedeEditarCondicionesFinancieras).toBe(true);
  });

  it('rechaza cambiar numero de cuotas cuando el prestamo ya tiene cuotas', async () => {
    prestamoRepository.findById.mockResolvedValue(
      crearPrestamo({ cuotas: [crearCuota()] }),
    );

    const update = service.update(10, { numeroCuotas: 4 });

    await expect(update).rejects.toBeInstanceOf(BadRequestException);
    await expect(update).rejects.toThrow(
      'El prestamo ya tiene cuotas generadas y no se puede modificar el numero de cuotas.',
    );
  });

  it('rechaza cambiar monto cuando el prestamo ya tiene cuotas', async () => {
    prestamoRepository.findById.mockResolvedValue(
      crearPrestamo({ cuotas: [crearCuota()] }),
    );

    await expect(service.update(10, { monto: 1500 })).rejects.toThrow(
      'El prestamo ya tiene cuotas generadas y no se puede modificar el monto.',
    );

    expect(prestamoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza cambiar fecha de inicio cuando el prestamo ya tiene cuotas', async () => {
    prestamoRepository.findById.mockResolvedValue(
      crearPrestamo({ cuotas: [crearCuota()] }),
    );

    await expect(
      service.update(10, { fechaInicio: '2026-04-01' }),
    ).rejects.toThrow(
      'El prestamo ya tiene cuotas generadas y no se puede modificar la fecha de inicio.',
    );

    expect(prestamoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza cambiar cliente cuando el prestamo ya tiene cuotas', async () => {
    prestamoRepository.findById.mockResolvedValue(
      crearPrestamo({ cuotas: [crearCuota()] }),
    );

    await expect(
      service.update(10, { clienteId: clienteActualizado.id }),
    ).rejects.toThrow(
      'El prestamo ya tiene cuotas generadas y no se puede cambiar el cliente asociado.',
    );

    expect(clienteRepository.findById).not.toHaveBeenCalled();
    expect(prestamoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza cambios financieros cuando el prestamo ya tiene pagos registrados', async () => {
    prestamoRepository.findById.mockResolvedValue(
      crearPrestamo({
        cuotas: [crearCuota({ pagos: [crearPago()] })],
      }),
    );

    await expect(service.update(10, { monto: 1500 })).rejects.toThrow(
      'El prestamo ya tiene pagos registrados y no se pueden modificar sus condiciones financieras.',
    );

    expect(prestamoRepository.save).not.toHaveBeenCalled();
  });

  it('permite actualizar estado aunque el prestamo tenga cuotas y pagos', async () => {
    prestamoRepository.findById.mockResolvedValue(
      crearPrestamo({
        cuotas: [crearCuota({ pagos: [crearPago()] })],
      }),
    );

    const response = await service.update(10, { estado: 'FINALIZADO' });

    expect(prestamoRepository.save).toHaveBeenCalledTimes(1);
    expect(response.prestamo.estado).toBe('FINALIZADO');
    expect(response.prestamo.tienePagosRegistrados).toBe(true);
    expect(response.prestamo.puedeEditarCondicionesFinancieras).toBe(false);
  });
});
