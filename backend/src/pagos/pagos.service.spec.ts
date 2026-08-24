/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { Cliente } from '../clientes/entities/cliente.entity';
import { Cuota } from '../cuotas/entities/cuota.entity';
import { CuotaRepository } from '../cuotas/repositories/cuota.repository';
import { Prestamo } from '../prestamos/entities/prestamo.entity';
import { Pago } from './entities/pago.entity';
import { PagosService } from './pagos.service';
import { PagoRepository } from './repositories/pago.repository';

describe('PagosService', () => {
  let service: PagosService;
  let dataSource: { transaction: jest.Mock };
  let pagoRepository: { findById: jest.Mock };
  let cuotaTransactionalRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let pagoTransactionalRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let cuotaActual: Cuota;
  let pagosGuardados: Pago[];
  let pagoId: number;
  let rollbackDetectado: boolean;
  let colaTransacciones: Promise<unknown>;

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

  const prestamo = {
    id: 1,
    clienteId: 1,
    cliente,
    monto: 500,
    fechaInicio: '2026-01-01',
    numeroCuotas: 1,
    estado: 'ACTIVO',
    cuotas: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Prestamo;

  function crearCuota(saldoPendiente = 500, estado = 'PENDIENTE'): Cuota {
    return {
      id: 1,
      prestamoId: prestamo.id,
      prestamo,
      numeroCuota: 1,
      fechaVencimiento: '2026-02-01',
      monto: 500,
      saldoPendiente,
      estado,
      pagos: [],
      gestionesCobranza: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Cuota;
  }

  beforeEach(() => {
    cuotaActual = crearCuota();
    pagosGuardados = [];
    pagoId = 1;
    rollbackDetectado = false;
    colaTransacciones = Promise.resolve();

    cuotaTransactionalRepository = {
      findOne: jest.fn().mockImplementation(async () => cuotaActual),
      save: jest.fn().mockImplementation(async (cuota: Cuota) => {
        cuotaActual = cuota;
        return cuota;
      }),
    };
    pagoTransactionalRepository = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn().mockImplementation(async (pago: Pago) => {
        const savedPago = {
          ...pago,
          id: pagoId,
          createdAt: new Date(),
        };

        pagoId += 1;
        pagosGuardados.push(savedPago);

        return savedPago;
      }),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Cuota) {
          return cuotaTransactionalRepository;
        }

        if (entity === Pago) {
          return pagoTransactionalRepository;
        }

        throw new Error('Repositorio no simulado');
      }),
    } as unknown as EntityManager;

    dataSource = {
      transaction: jest.fn((callback) => {
        const ejecutar = colaTransacciones.then(async () => {
          try {
            return await callback(manager);
          } catch (error) {
            rollbackDetectado = true;
            throw error;
          }
        });

        colaTransacciones = ejecutar.catch(() => undefined);

        return ejecutar;
      }),
    };
    pagoRepository = {
      findById: jest.fn(async (id: number) => {
        const pago = pagosGuardados.find((item) => item.id === id);

        return pago ? { ...pago, cuota: cuotaActual } : null;
      }),
    };

    service = new PagosService(
      pagoRepository as unknown as PagoRepository,
      {} as CuotaRepository,
      dataSource as unknown as DataSource,
    );
  });

  it('registra pago parcial sin marcar la cuota como pagada', async () => {
    const response = await service.create({
      cuotaId: 1,
      monto: 300,
      fechaPago: '2026-02-10',
      metodoPago: 'EFECTIVO',
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(response.success).toBe(true);
    expect(response.pago.cuota.saldoPendiente).toBe(200);
    expect(response.pago.cuota.estado).toBe('PENDIENTE');
  });

  it('registra pago total y marca la cuota como PAGADA', async () => {
    cuotaActual = crearCuota(300);

    const response = await service.create({
      cuotaId: 1,
      monto: 300,
      fechaPago: '2026-02-10',
      metodoPago: 'TRANSFERENCIA',
    });

    expect(response.pago.cuota.saldoPendiente).toBe(0);
    expect(response.pago.cuota.estado).toBe('PAGADA');
  });

  it('rechaza pagos mayores al saldo pendiente y evita saldo negativo', async () => {
    cuotaActual = crearCuota(200);

    await expect(
      service.create({
        cuotaId: 1,
        monto: 300,
        fechaPago: '2026-02-10',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(pagoTransactionalRepository.save).not.toHaveBeenCalled();
    expect(cuotaTransactionalRepository.save).not.toHaveBeenCalled();
    expect(cuotaActual.saldoPendiente).toBe(200);
  });

  it('usa bloqueo pesimista sobre la cuota durante la transaccion', async () => {
    await service.create({
      cuotaId: 1,
      monto: 100,
      fechaPago: '2026-02-10',
    });

    expect(cuotaTransactionalRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        lock: {
          mode: 'pessimistic_write',
        },
      }),
    );
  });

  it('propaga errores al actualizar la cuota para permitir rollback completo', async () => {
    cuotaTransactionalRepository.save.mockRejectedValueOnce(
      new Error('fallo controlado al actualizar cuota'),
    );

    await expect(
      service.create({
        cuotaId: 1,
        monto: 100,
        fechaPago: '2026-02-10',
      }),
    ).rejects.toThrow('fallo controlado al actualizar cuota');

    expect(pagoTransactionalRepository.save).toHaveBeenCalledTimes(1);
    expect(cuotaTransactionalRepository.save).toHaveBeenCalledTimes(1);
    expect(rollbackDetectado).toBe(true);
  });

  it('evita pagos simultaneos incompatibles sobre la misma cuota', async () => {
    cuotaActual = crearCuota(500);

    const resultados = await Promise.allSettled([
      service.create({
        cuotaId: 1,
        monto: 300,
        fechaPago: '2026-02-10',
      }),
      service.create({
        cuotaId: 1,
        monto: 300,
        fechaPago: '2026-02-10',
      }),
    ]);

    expect(resultados[0].status).toBe('fulfilled');
    expect(resultados[1].status).toBe('rejected');
    expect(pagosGuardados).toHaveLength(1);
    expect(cuotaActual.saldoPendiente).toBe(200);
    expect(cuotaActual.saldoPendiente).toBeGreaterThanOrEqual(0);
    expect(cuotaTransactionalRepository.findOne).toHaveBeenCalledTimes(2);
  });
});
