/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Cliente } from '../clientes/entities/cliente.entity';
import { Cuota } from '../cuotas/entities/cuota.entity';
import { CuotaRepository } from '../cuotas/repositories/cuota.repository';
import {
  CanalNotificacion,
  ResultadoNotificacion,
} from '../notificaciones/notificaciones.service';
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
  let saldosPrestamoParaListado: Array<{
    prestamoId: string;
    saldoPendiente: string;
  }>;

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

  function crearDtoRiesgoAlto(
    overrides: Partial<CreateGestionCobranzaDto> = {},
  ): CreateGestionCobranzaDto {
    return {
      ...dtoBase,
      nivelRiesgo: 'ALTO',
      prioridad: 'ALTA',
      accion: 'Seguimiento prioritario',
      mensajeWhatsapp: 'Mensaje corto de WhatsApp para riesgo alto',
      canales: ['CORREO', 'WHATSAPP'],
      ...overrides,
    };
  }

  function resultadoEnvio(
    canal: CanalNotificacion,
    estado: 'ENVIADO' | 'ERROR' | 'NO_CONFIGURADO',
  ): ResultadoNotificacion {
    return {
      canal,
      estado,
      detalle: `${canal} ${estado}`,
      proveedor: canal === 'CORREO' ? 'SMTP' : 'WhatsApp Cloud API',
      fecha: '2026-02-10T00:00:00.000Z',
    };
  }

  function crearGestionExistente(
    overrides: Partial<GestionCobranza> = {},
  ): GestionCobranza {
    return {
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
      canalesSolicitados: ['CORREO', 'WHATSAPP'],
      estadoEnvio: 'PARCIAL',
      resultadoEnvio: [
        resultadoEnvio('CORREO', 'ENVIADO'),
        resultadoEnvio('WHATSAPP', 'ERROR'),
      ],
      createdAt: new Date(),
      ...overrides,
    };
  }

  function crearGestionAltoExistente(
    overrides: Partial<GestionCobranza> = {},
  ): GestionCobranza {
    return crearGestionExistente({
      nivelRiesgo: 'ALTO',
      prioridad: 'ALTA',
      accion: 'Seguimiento prioritario',
      canalesSolicitados: ['CORREO', 'WHATSAPP'],
      ...overrides,
    });
  }

  beforeEach(() => {
    const cuota = crearCuota();
    cuotasParaSaldoPrestamo = [cuota];
    gestionRepository = {
      findAll: jest.fn(),
      findByClaveGestion: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (gestion) => ({
        ...gestion,
        id: gestion.id ?? 1,
        createdAt: gestion.createdAt ?? new Date(),
      })),
    };
    cuotaRepository = {
      findById: jest.fn().mockResolvedValue(cuota),
    };
    notificacionesService = {
      enviarGestion: jest
        .fn()
        .mockResolvedValue([
          resultadoEnvio('CORREO', 'ENVIADO'),
        ] satisfies ResultadoNotificacion[]),
    };
    saldosPrestamoParaListado = [
      {
        prestamoId: String(prestamo.id),
        saldoPendiente: '500',
      },
    ];
    const cuotaQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => saldosPrestamoParaListado),
    };
    const dataSource = {
      getRepository: jest.fn(() => ({
        find: jest.fn(async () => cuotasParaSaldoPrestamo),
        createQueryBuilder: jest.fn(() => cuotaQueryBuilder),
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
    expect(payload.saldoPendientePrestamo).toBe(200);
    expect(payload.nivelRiesgo).toBe('MEDIO');
    expect(payload.mensaje).toContain('Saldo pendiente: $200');
    expect(response.gestion?.mensaje).toContain('Saldo pendiente: $200');
  });

  it.each<[string, string, string, CanalNotificacion[], string | undefined]>([
    ['BAJO', 'BAJA', 'Aviso preventivo', ['CORREO'], undefined],
    ['MEDIO', 'MEDIA', 'Recordatorio de mora temprana', ['CORREO'], undefined],
    [
      'ALTO',
      'ALTA',
      'Seguimiento prioritario',
      ['CORREO', 'WHATSAPP'],
      'Mensaje corto de WhatsApp para riesgo alto',
    ],
    [
      'CRITICO',
      'MAXIMA',
      'Revision critica',
      ['CORREO', 'WHATSAPP'],
      'Mensaje corto de WhatsApp para riesgo critico',
    ],
  ])(
    'respeta canales definitivos para riesgo %s',
    async (nivelRiesgo, prioridad, accion, canales, mensajeWhatsapp) => {
      await service.create({
        ...dtoBase,
        nivelRiesgo,
        prioridad,
        accion,
        canales,
        mensajeWhatsapp,
      });
      const payload = notificacionesService.enviarGestion.mock.calls[0][0];

      expect(payload.canales).toEqual(canales);
      expect(payload.mensajeWhatsapp).toBe(mensajeWhatsapp);
    },
  );

  it('convierte riesgo MEDIO a solo correo aunque n8n envie WhatsApp', async () => {
    await service.create({
      ...dtoBase,
      nivelRiesgo: 'MEDIO',
      canales: ['CORREO', 'WHATSAPP'],
    });
    const payload = notificacionesService.enviarGestion.mock.calls[0][0];

    expect(payload.canales).toEqual(['CORREO']);
  });

  it.each([
    ['BAJO', 'BAJA', 'Aviso preventivo'],
    ['MEDIO', 'MEDIA', 'Recordatorio de mora temprana'],
  ])(
    'no crea alerta interna especial para riesgo %s',
    async (nivelRiesgo, prioridad, accion) => {
      const response = await service.create({
        ...dtoBase,
        nivelRiesgo,
        prioridad,
        accion,
        canales: ['CORREO'],
      });

      expect(response.gestion?.alertaInterna).toBeNull();
      expect(notificacionesService.enviarGestion).toHaveBeenCalledTimes(1);
    },
  );

  it('crea alerta interna de seguimiento prioritario para riesgo ALTO', async () => {
    const response = await service.create({
      ...dtoBase,
      nivelRiesgo: 'ALTO',
      prioridad: 'ALTA',
      accion: 'Seguimiento prioritario',
      canales: ['CORREO', 'WHATSAPP'],
    });
    const alerta = response.gestion?.alertaInterna;

    expect(alerta).toMatchObject({
      tipo: 'ALERTA_ALTO',
      prioridad: 'ALTA',
      accionRecomendada: 'Seguimiento prioritario',
      requiereIntervencionHumana: false,
    });
    expect(alerta?.mensaje).toContain('Cliente: Cliente Prueba');
    expect(alerta?.mensaje).toContain('Cuota: 1');
    expect(alerta?.mensaje).toContain('Saldo cuota: $500');
    expect(alerta?.mensaje).toContain('Saldo prestamo: $500');
    expect(alerta?.mensaje).toContain('Dias de mora: 5');
  });

  it('crea alerta urgente para riesgo CRITICO con intervencion humana', async () => {
    const response = await service.create({
      ...dtoBase,
      nivelRiesgo: 'CRITICO',
      prioridad: 'MAXIMA',
      accion: 'Revision critica y contacto urgente',
      canales: ['CORREO', 'WHATSAPP'],
    });
    const alerta = response.gestion?.alertaInterna;

    expect(alerta).toMatchObject({
      tipo: 'ALERTA_CRITICA',
      prioridad: 'MAXIMA',
      accionRecomendada: 'Contacto inmediato y revision manual',
      requiereIntervencionHumana: true,
    });
  });

  it('devuelve alertas internas calculadas en el listado de gestiones', async () => {
    gestionRepository.findAll.mockResolvedValueOnce([
      {
        id: 10,
        claveGestion: '2026-02-10:25:seguimiento-prioritario',
        cuotaId: 25,
        cuota: crearCuota(350, 'VENCIDA'),
        fechaGestion: '2026-02-10',
        tipoGestion: 'VENCIDA',
        diasAtraso: 20,
        nivelRiesgo: 'ALTO',
        prioridad: 'ALTA',
        accion: 'Seguimiento prioritario',
        mensaje: 'Gestion alto',
        modo: 'Produccion',
        clienteNombre: 'Cliente Prueba',
        clienteEmail: 'cliente@example.com',
        clienteTelefono: '0999999999',
        canalesSolicitados: ['CORREO', 'WHATSAPP'],
        estadoEnvio: 'ENVIADO',
        resultadoEnvio: null,
        createdAt: new Date(),
      },
      {
        id: 11,
        claveGestion: '2026-02-10:25:aviso-preventivo',
        cuotaId: 25,
        cuota: crearCuota(500, 'PENDIENTE'),
        fechaGestion: '2026-02-10',
        tipoGestion: 'VENCE_MANANA',
        diasAtraso: 0,
        nivelRiesgo: 'BAJO',
        prioridad: 'BAJA',
        accion: 'Aviso preventivo',
        mensaje: 'Gestion bajo',
        modo: 'Produccion',
        clienteNombre: 'Cliente Prueba',
        clienteEmail: 'cliente@example.com',
        clienteTelefono: '0999999999',
        canalesSolicitados: ['CORREO'],
        estadoEnvio: 'ENVIADO',
        resultadoEnvio: null,
        createdAt: new Date(),
      },
    ] as GestionCobranza[]);
    saldosPrestamoParaListado = [
      {
        prestamoId: String(prestamo.id),
        saldoPendiente: '850',
      },
    ];

    const response = await service.findAll();

    expect(response.gestiones[0].alertaInterna).toMatchObject({
      tipo: 'ALERTA_ALTO',
      prioridad: 'ALTA',
    });
    expect(response.gestiones[0].alertaInterna?.mensaje).toContain(
      'Saldo prestamo: $850',
    );
    expect(response.gestiones[1].alertaInterna).toBeNull();
  });

  it('usa saldos actuales de cuota y prestamo cuando n8n envia saldos viejos', async () => {
    const cuotaActual = crearCuota(200, 'PENDIENTE');

    cuotaRepository.findById.mockResolvedValueOnce(cuotaActual);
    cuotasParaSaldoPrestamo = [
      cuotaActual,
      {
        ...crearCuota(1000, 'PENDIENTE'),
        id: 26,
        numeroCuota: 2,
      },
    ];

    await service.create({
      ...dtoBase,
      canales: ['CORREO', 'WHATSAPP'],
      mensaje:
        'Saldo pendiente: $500. Saldo pendiente actual del prestamo:\n$2000.',
      mensajeWhatsapp: 'Saldo pendiente total:\n$2000. Saldo pendiente: $500.',
    });
    const payload = notificacionesService.enviarGestion.mock.calls[0][0];

    expect(payload.saldoPendiente).toBe(200);
    expect(payload.saldoPendientePrestamo).toBe(1200);
    expect(payload.nivelRiesgo).toBe('MEDIO');
    expect(payload.mensaje).toContain('Saldo pendiente: $200');
    expect(payload.mensaje).toContain(
      'Saldo pendiente actual del prestamo:\n$1200',
    );
    expect(payload.mensajeWhatsapp).toContain('Saldo pendiente total:\n$1200');
    expect(payload.mensajeWhatsapp).toContain('Saldo pendiente: $200');
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

  it('reintenta solo WhatsApp cuando correo ya fue enviado y WhatsApp fallo', async () => {
    const dtoAlto = crearDtoRiesgoAlto();
    const gestionExistente = crearGestionAltoExistente();

    gestionRepository.findByClaveGestion.mockResolvedValueOnce(
      gestionExistente,
    );
    notificacionesService.enviarGestion.mockResolvedValueOnce([
      resultadoEnvio('WHATSAPP', 'ENVIADO'),
    ]);

    const response = await service.create(dtoAlto);
    const payload = notificacionesService.enviarGestion.mock.calls[0][0];
    const gestionGuardada = gestionRepository.save.mock.calls[0][0];

    expect(response.procesada).toBe(true);
    expect(payload.canales).toEqual(['WHATSAPP']);
    expect(gestionRepository.create).not.toHaveBeenCalled();
    expect(gestionRepository.save).toHaveBeenCalledTimes(1);
    expect(gestionGuardada.resultadoEnvio).toEqual([
      resultadoEnvio('CORREO', 'ENVIADO'),
      resultadoEnvio('WHATSAPP', 'ENVIADO'),
    ]);
    expect(gestionGuardada.estadoEnvio).toBe('ENVIADO');
  });

  it('no reenvia nada cuando correo y WhatsApp ya fueron enviados', async () => {
    const gestionExistente = crearGestionAltoExistente({
      estadoEnvio: 'ENVIADO',
      resultadoEnvio: [
        resultadoEnvio('CORREO', 'ENVIADO'),
        resultadoEnvio('WHATSAPP', 'ENVIADO'),
      ],
    });

    gestionRepository.findByClaveGestion.mockResolvedValueOnce(
      gestionExistente,
    );

    const response = await service.create(crearDtoRiesgoAlto());

    expect(response.procesada).toBe(true);
    expect(response.gestion).toBe(gestionExistente);
    expect(notificacionesService.enviarGestion).not.toHaveBeenCalled();
    expect(gestionRepository.create).not.toHaveBeenCalled();
    expect(gestionRepository.save).not.toHaveBeenCalled();
  });

  it('reintenta ambos canales cuando correo y WhatsApp fallaron', async () => {
    const gestionExistente = crearGestionAltoExistente({
      estadoEnvio: 'ERROR',
      resultadoEnvio: [
        resultadoEnvio('CORREO', 'ERROR'),
        resultadoEnvio('WHATSAPP', 'ERROR'),
      ],
    });

    gestionRepository.findByClaveGestion.mockResolvedValueOnce(
      gestionExistente,
    );
    notificacionesService.enviarGestion.mockResolvedValueOnce([
      resultadoEnvio('CORREO', 'ENVIADO'),
      resultadoEnvio('WHATSAPP', 'ERROR'),
    ]);

    await service.create(crearDtoRiesgoAlto());
    const payload = notificacionesService.enviarGestion.mock.calls[0][0];
    const gestionGuardada = gestionRepository.save.mock.calls[0][0];

    expect(payload.canales).toEqual(['CORREO', 'WHATSAPP']);
    expect(gestionRepository.create).not.toHaveBeenCalled();
    expect(gestionGuardada.resultadoEnvio).toEqual([
      resultadoEnvio('CORREO', 'ENVIADO'),
      resultadoEnvio('WHATSAPP', 'ERROR'),
    ]);
    expect(gestionGuardada.estadoEnvio).toBe('PARCIAL');
  });

  it('no repite correo para BAJO cuando ya fue enviado', async () => {
    const gestionExistente = crearGestionExistente({
      canalesSolicitados: ['CORREO'],
      nivelRiesgo: 'BAJO',
      prioridad: 'BAJA',
      accion: 'Aviso preventivo',
      estadoEnvio: 'ENVIADO',
      resultadoEnvio: [resultadoEnvio('CORREO', 'ENVIADO')],
    });

    gestionRepository.findByClaveGestion.mockResolvedValueOnce(
      gestionExistente,
    );

    const response = await service.create({
      ...dtoBase,
      nivelRiesgo: 'BAJO',
      prioridad: 'BAJA',
      accion: 'Aviso preventivo',
      canales: ['CORREO'],
    });

    expect(response.gestion).toBe(gestionExistente);
    expect(notificacionesService.enviarGestion).not.toHaveBeenCalled();
    expect(gestionRepository.save).not.toHaveBeenCalled();
  });

  it('no reintenta WhatsApp si la cuota fue pagada despues del fallo', async () => {
    cuotaRepository.findById.mockResolvedValueOnce(crearCuota(0, 'PAGADA'));
    cuotasParaSaldoPrestamo = [crearCuota(0, 'PAGADA')];
    gestionRepository.findByClaveGestion.mockResolvedValueOnce(
      crearGestionExistente(),
    );

    const response = await service.create(dtoBase);

    expect(response.procesada).toBe(false);
    expect(response.motivo).toBe('CUOTA_YA_PAGADA');
    expect(gestionRepository.findByClaveGestion).not.toHaveBeenCalled();
    expect(notificacionesService.enviarGestion).not.toHaveBeenCalled();
    expect(gestionRepository.save).not.toHaveBeenCalled();
  });

  it('no reintenta canales si el prestamo tiene saldo 0', async () => {
    cuotaRepository.findById.mockResolvedValueOnce(crearCuota(100, 'VENCIDA'));
    cuotasParaSaldoPrestamo = [crearCuota(0, 'PAGADA')];
    gestionRepository.findByClaveGestion.mockResolvedValueOnce(
      crearGestionExistente(),
    );

    const response = await service.create(dtoBase);

    expect(response.procesada).toBe(false);
    expect(response.motivo).toBe('PRESTAMO_SIN_SALDO');
    expect(gestionRepository.findByClaveGestion).not.toHaveBeenCalled();
    expect(notificacionesService.enviarGestion).not.toHaveBeenCalled();
    expect(gestionRepository.save).not.toHaveBeenCalled();
  });

  it('mantiene la misma claveGestion y no crea duplicado al reintentar', async () => {
    const dtoAlto = crearDtoRiesgoAlto();
    const gestionExistente = crearGestionAltoExistente();

    gestionRepository.findByClaveGestion.mockResolvedValueOnce(
      gestionExistente,
    );
    notificacionesService.enviarGestion.mockResolvedValueOnce([
      resultadoEnvio('WHATSAPP', 'ENVIADO'),
    ]);

    await service.create(dtoAlto);
    const gestionGuardada = gestionRepository.save.mock.calls[0][0];

    expect(gestionRepository.create).not.toHaveBeenCalled();
    expect(gestionGuardada.id).toBe(gestionExistente.id);
    expect(gestionGuardada.claveGestion).toBe(gestionExistente.claveGestion);
  });

  it('preserva alerta ALTO sin duplicar registro por reintento', async () => {
    const gestionExistente = crearGestionExistente({
      nivelRiesgo: 'ALTO',
      prioridad: 'ALTA',
      accion: 'Seguimiento prioritario',
    });

    gestionRepository.findByClaveGestion.mockResolvedValueOnce(
      gestionExistente,
    );
    notificacionesService.enviarGestion.mockResolvedValueOnce([
      resultadoEnvio('WHATSAPP', 'ENVIADO'),
    ]);

    const response = await service.create({
      ...dtoBase,
      nivelRiesgo: 'ALTO',
      prioridad: 'ALTA',
      accion: 'Seguimiento prioritario',
      canales: ['CORREO', 'WHATSAPP'],
    });

    expect(gestionRepository.create).not.toHaveBeenCalled();
    expect(gestionRepository.save).toHaveBeenCalledTimes(1);
    expect(response.gestion?.id).toBe(gestionExistente.id);
    expect(response.gestion?.alertaInterna).toMatchObject({
      tipo: 'ALERTA_ALTO',
      prioridad: 'ALTA',
      requiereIntervencionHumana: false,
    });
  });

  it('preserva alerta CRITICA sin duplicar intervencion humana por reintento', async () => {
    const gestionExistente = crearGestionExistente({
      nivelRiesgo: 'CRITICO',
      prioridad: 'MAXIMA',
      accion: 'Revision critica y contacto urgente',
    });

    gestionRepository.findByClaveGestion.mockResolvedValueOnce(
      gestionExistente,
    );
    notificacionesService.enviarGestion.mockResolvedValueOnce([
      resultadoEnvio('WHATSAPP', 'ENVIADO'),
    ]);

    const response = await service.create({
      ...dtoBase,
      nivelRiesgo: 'CRITICO',
      prioridad: 'MAXIMA',
      accion: 'Revision critica y contacto urgente',
      canales: ['CORREO', 'WHATSAPP'],
    });

    expect(gestionRepository.create).not.toHaveBeenCalled();
    expect(gestionRepository.save).toHaveBeenCalledTimes(1);
    expect(response.gestion?.id).toBe(gestionExistente.id);
    expect(response.gestion?.alertaInterna).toMatchObject({
      tipo: 'ALERTA_CRITICA',
      prioridad: 'MAXIMA',
      requiereIntervencionHumana: true,
    });
  });

  it('mantiene error controlado si la cuota no existe', async () => {
    cuotaRepository.findById.mockResolvedValueOnce(null);

    await expect(service.create(dtoBase)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(notificacionesService.enviarGestion).not.toHaveBeenCalled();
  });
});
