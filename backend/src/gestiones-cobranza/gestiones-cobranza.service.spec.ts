/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Cliente } from '../clientes/entities/cliente.entity';
import { Cuota } from '../cuotas/entities/cuota.entity';
import { CuotaRepository } from '../cuotas/repositories/cuota.repository';
import { ResultadoNotificacion } from '../notificaciones/notificaciones.service';
import { Prestamo } from '../prestamos/entities/prestamo.entity';
import { CreateGestionCobranzaDto } from './dto/create-gestion-cobranza.dto';
import { GestionCobranza } from './entities/gestion-cobranza.entity';
import { GestionesCobranzaService } from './gestiones-cobranza.service';
import { GestionCobranzaRepository } from './repositories/gestion-cobranza.repository';

describe('GestionesCobranzaService', () => {
  let service: GestionesCobranzaService;
  let gestionRepository: {
    findAll: jest.Mock;
    findByClaveGestion: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let cuotaRepository: {
    findById: jest.Mock;
  };
  let notificacionesService: {
    enviarGestion: jest.Mock;
  };
  let cuotasParaSaldoPrestamo: Cuota[];

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

  function crearCuota(
    saldoPendiente = 500,
    estado: 'PENDIENTE' | 'PAGADA' | 'VENCIDA' = 'PENDIENTE',
  ): Cuota {
    return {
      id: 25,
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
    };
  }

  const dtoBase: CreateGestionCobranzaDto = {
    cuotaId: 25,
    tipoGestion: 'VENCIDA',
    diasAtraso: 5,
    nivelRiesgo: 'MEDIO',
    prioridad: 'MEDIA',
    accion: 'Recordatorio de mora temprana',
    mensaje:
      'Recordatorio de mora temprana: saldo pendiente: $500. Regularice el pago.',
    modo: 'Produccion',
    fechaGestion: '2026-02-10',
    canales: ['CORREO', 'WHATSAPP'],
  };

  beforeEach(() => {
    const cuota = crearCuota();
    cuotasParaSaldoPrestamo = [cuota];
    gestionRepository = {
      findAll: jest.fn(),
      findByClaveGestion: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (gestion) => ({
        ...gestion,
        id: 1,
        createdAt: new Date(),
      })),
    };
    cuotaRepository = {
      findById: jest.fn().mockResolvedValue(cuota),
    };
    notificacionesService = {
      enviarGestion: jest.fn().mockResolvedValue([
        {
          canal: 'CORREO',
          estado: 'ENVIADO',
          detalle: 'Correo simulado',
          proveedor: 'SMTP',
          fecha: '2026-02-10T00:00:00.000Z',
        },
      ] satisfies ResultadoNotificacion[]),
    };
    const dataSource = {
      getRepository: jest.fn(() => ({
        find: jest.fn(async () => cuotasParaSaldoPrestamo),
      })),
    };

    service = new GestionesCobranzaService(
      gestionRepository as unknown as GestionCobranzaRepository,
      cuotaRepository as unknown as CuotaRepository,
      notificacionesService as never,
      dataSource as unknown as DataSource,
    );
  });

  it('permite gestion cuando la cuota esta pendiente y tiene saldo', async () => {
    const response = await service.create(dtoBase);

    expect(response.success).toBe(true);
    expect(response.procesada).toBe(true);
    expect(response.gestion).not.toBeNull();
    expect(notificacionesService.enviarGestion).toHaveBeenCalledTimes(1);
    expect(gestionRepository.save).toHaveBeenCalledTimes(1);
  });

  it('omite gestion y no envia si la cuota esta PAGADA', async () => {
    cuotaRepository.findById.mockResolvedValueOnce(crearCuota(0, 'PAGADA'));
    cuotasParaSaldoPrestamo = [crearCuota(0, 'PAGADA')];

    const response = await service.create(dtoBase);

    expect(response.procesada).toBe(false);
    expect(response.motivo).toBe('CUOTA_YA_PAGADA');
    expect(response.gestion).toBeNull();
    expect(notificacionesService.enviarGestion).not.toHaveBeenCalled();
    expect(gestionRepository.save).not.toHaveBeenCalled();
  });

  it('omite gestion y no envia si saldoPendiente es 0', async () => {
    cuotaRepository.findById.mockResolvedValueOnce(crearCuota(0, 'PENDIENTE'));
    cuotasParaSaldoPrestamo = [crearCuota(0, 'PENDIENTE')];

    const response = await service.create(dtoBase);

    expect(response.procesada).toBe(false);
    expect(response.motivo).toBe('CUOTA_SIN_SALDO');
    expect(notificacionesService.enviarGestion).not.toHaveBeenCalled();
    expect(gestionRepository.save).not.toHaveBeenCalled();
  });

  it('omite gestion y no envia si el prestamo tiene saldo total 0', async () => {
    cuotaRepository.findById.mockResolvedValueOnce(
      crearCuota(100, 'PENDIENTE'),
    );
    cuotasParaSaldoPrestamo = [crearCuota(0, 'PENDIENTE')];

    const response = await service.create(dtoBase);

    expect(response.procesada).toBe(false);
    expect(response.motivo).toBe('PRESTAMO_SIN_SALDO');
    expect(response.saldoPendientePrestamo).toBe(0);
    expect(notificacionesService.enviarGestion).not.toHaveBeenCalled();
    expect(gestionRepository.save).not.toHaveBeenCalled();
  });

  it('usa el saldo actual de BD cuando n8n envia un mensaje con saldo viejo', async () => {
    const cuotaActual = crearCuota(200, 'PENDIENTE');

    cuotaRepository.findById.mockResolvedValueOnce(cuotaActual);
    cuotasParaSaldoPrestamo = [cuotaActual];

    const response = await service.create({
      ...dtoBase,
      mensaje:
        'Recordatorio de mora temprana: Saldo pendiente: $500. Regularice el pago.',
    });
    const payload = notificacionesService.enviarGestion.mock.calls[0][0];

    expect(response.procesada).toBe(true);
    expect(payload.saldoPendiente).toBe(200);
    expect(payload.mensaje).toContain('Saldo pendiente: $200');
    expect(response.gestion?.mensaje).toContain('Saldo pendiente: $200');
  });

  it('omite gestion si la cuota fue pagada entre GET de n8n y POST al backend', async () => {
    cuotaRepository.findById.mockResolvedValueOnce(crearCuota(0, 'PAGADA'));
    cuotasParaSaldoPrestamo = [crearCuota(0, 'PAGADA')];

    const response = await service.create({
      ...dtoBase,
      mensaje:
        'n8n aun cree que la cuota esta pendiente con saldo pendiente: $500',
    });

    expect(response.procesada).toBe(false);
    expect(response.motivo).toBe('CUOTA_YA_PAGADA');
    expect(notificacionesService.enviarGestion).not.toHaveBeenCalled();
    expect(gestionRepository.create).not.toHaveBeenCalled();
    expect(gestionRepository.save).not.toHaveBeenCalled();
  });

  it('conserva el comportamiento de devolver una gestion existente valida', async () => {
    const gestionExistente = {
      id: 9,
      claveGestion: '2026-02-10:25:recordatorio-de-mora-temprana',
      cuotaId: 25,
      cuota: crearCuota(),
      fechaGestion: '2026-02-10',
      tipoGestion: 'VENCIDA',
      diasAtraso: 5,
      nivelRiesgo: 'MEDIO',
      prioridad: 'MEDIA',
      accion: 'Recordatorio de mora temprana',
      mensaje: 'Gestion previa',
      modo: 'Produccion',
      clienteNombre: 'Cliente Prueba',
      clienteEmail: 'cliente@example.com',
      clienteTelefono: '0999999999',
      canalesSolicitados: ['CORREO'],
      estadoEnvio: 'ENVIADO',
      resultadoEnvio: null,
      createdAt: new Date(),
    } as GestionCobranza;

    gestionRepository.findByClaveGestion.mockResolvedValueOnce(
      gestionExistente,
    );

    const response = await service.create(dtoBase);

    expect(response.procesada).toBe(true);
    expect(response.gestion).toBe(gestionExistente);
    expect(notificacionesService.enviarGestion).not.toHaveBeenCalled();
    expect(gestionRepository.save).not.toHaveBeenCalled();
  });

  it('mantiene error controlado si la cuota no existe', async () => {
    cuotaRepository.findById.mockResolvedValueOnce(null);

    await expect(service.create(dtoBase)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(notificacionesService.enviarGestion).not.toHaveBeenCalled();
  });
});
