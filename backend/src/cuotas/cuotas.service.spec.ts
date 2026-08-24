import { Cliente } from '../clientes/entities/cliente.entity';
import { Prestamo } from '../prestamos/entities/prestamo.entity';
import { PrestamoRepository } from '../prestamos/repositories/prestamo.repository';
import { Cuota } from './entities/cuota.entity';
import { CuotasService } from './cuotas.service';
import { CuotaRepository } from './repositories/cuota.repository';

describe('CuotasService', () => {
  let service: CuotasService;
  let cuotaRepository: {
    findPendientesParaPago: jest.Mock;
  };

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
    id: 10,
    clienteId: cliente.id,
    cliente,
    monto: 1500,
    fechaInicio: '2026-01-01',
    numeroCuotas: 3,
    estado: 'ACTIVO',
    cuotas: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Prestamo;

  function crearCuota(data: Partial<Cuota>): Cuota {
    return {
      id: 1,
      prestamoId: prestamo.id,
      prestamo,
      numeroCuota: 1,
      fechaVencimiento: '2026-09-30',
      monto: 500,
      saldoPendiente: 500,
      estado: 'PENDIENTE',
      pagos: [],
      gestionesCobranza: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
  }

  beforeEach(() => {
    cuotaRepository = {
      findPendientesParaPago: jest.fn(),
    };

    service = new CuotasService(
      cuotaRepository as unknown as CuotaRepository,
      {} as PrestamoRepository,
    );
  });

  it('devuelve cuotas futuras pendientes para permitir pago anticipado', async () => {
    cuotaRepository.findPendientesParaPago.mockResolvedValue([
      crearCuota({
        id: 1,
        numeroCuota: 1,
        fechaVencimiento: '2026-12-31',
        saldoPendiente: 500,
      }),
    ]);

    const response = await service.findPendientesParaPago();

    expect(response.cuotas).toHaveLength(1);
    expect(response.cuotas[0]).toEqual(
      expect.objectContaining({
        cuotaId: 1,
        prestamoId: 10,
        numeroCuota: 1,
        fechaVencimiento: '2026-12-31',
        montoCuota: 500,
        saldoPendiente: 500,
        estado: 'PENDIENTE',
        totalPagadoCuota: 0,
        saldoPendientePrestamo: 500,
      }),
    );
  });

  it('devuelve cuotas vencidas y parcialmente pagadas con saldos calculados', async () => {
    cuotaRepository.findPendientesParaPago.mockResolvedValue([
      crearCuota({
        id: 2,
        numeroCuota: 2,
        fechaVencimiento: '2026-01-31',
        estado: 'VENCIDA',
        monto: 500,
        saldoPendiente: 500,
      }),
      crearCuota({
        id: 3,
        numeroCuota: 3,
        fechaVencimiento: '2026-02-28',
        estado: 'PENDIENTE',
        monto: 500,
        saldoPendiente: 200,
      }),
    ]);

    const response = await service.findPendientesParaPago();

    expect(response.cuotas).toHaveLength(2);
    expect(response.cuotas[0]).toEqual(
      expect.objectContaining({
        cuotaId: 2,
        estado: 'VENCIDA',
        totalPagadoCuota: 0,
        saldoPendientePrestamo: 700,
      }),
    );
    expect(response.cuotas[1]).toEqual(
      expect.objectContaining({
        cuotaId: 3,
        estado: 'PENDIENTE',
        totalPagadoCuota: 300,
        saldoPendiente: 200,
        saldoPendientePrestamo: 700,
      }),
    );
  });

  it('no expone cuotas pagadas ni cuotas con saldo pendiente 0', async () => {
    cuotaRepository.findPendientesParaPago.mockResolvedValue([
      crearCuota({ id: 4, estado: 'PAGADA', saldoPendiente: 0 }),
      crearCuota({ id: 5, estado: 'PENDIENTE', saldoPendiente: 0 }),
      crearCuota({ id: 6, estado: 'PENDIENTE', saldoPendiente: 100 }),
    ]);

    const response = await service.findPendientesParaPago();

    expect(response.cuotas).toHaveLength(1);
    expect(response.cuotas[0].cuotaId).toBe(6);
    expect(response.cuotas[0].saldoPendientePrestamo).toBe(100);
  });

  it('calcula el saldo del prestamo como suma de cuotas pendientes', async () => {
    cuotaRepository.findPendientesParaPago.mockResolvedValue([
      crearCuota({ id: 7, numeroCuota: 1, saldoPendiente: 100.25 }),
      crearCuota({ id: 8, numeroCuota: 2, saldoPendiente: 200.15 }),
      crearCuota({ id: 9, numeroCuota: 3, saldoPendiente: 99.6 }),
    ]);

    const response = await service.findPendientesParaPago();

    expect(response.cuotas).toHaveLength(3);
    expect(
      response.cuotas.map((cuota) => cuota.saldoPendientePrestamo),
    ).toEqual([400, 400, 400]);
  });
});
