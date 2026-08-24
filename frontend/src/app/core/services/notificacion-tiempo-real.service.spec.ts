import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';

import {
  GestionCobranzaRegistro,
  GestionesCobranzaResponse,
} from '../../features/cobros/models/gestion-cobranza.model';
import { GestionCobranzaService } from './gestion-cobranza.service';
import { NotificacionTiempoRealService } from './notificacion-tiempo-real.service';

describe('NotificacionTiempoRealService', () => {
  let service: NotificacionTiempoRealService;
  let gestionCobranzaService: {
    findAll: () => Observable<GestionesCobranzaResponse>;
  };
  let response: GestionesCobranzaResponse;

  const baseGestion: GestionCobranzaRegistro = {
    id: 1,
    claveGestion: '2026-02-10:25:aviso-preventivo',
    cuotaId: 25,
    fechaGestion: '2026-02-10',
    tipoGestion: 'VENCE_MANANA',
    diasAtraso: 0,
    nivelRiesgo: 'BAJO',
    prioridad: 'BAJA',
    accion: 'Aviso preventivo',
    mensaje: 'Gestion registrada',
    modo: 'Produccion',
    clienteNombre: 'Cliente Prueba',
    clienteEmail: 'cliente@example.com',
    clienteTelefono: '0999999999',
    canalesSolicitados: ['CORREO'],
    estadoEnvio: 'ENVIADO',
    resultadoEnvio: null,
    alertaInterna: null,
    createdAt: '2026-02-10T10:00:00.000Z',
  };

  beforeEach(() => {
    localStorage.clear();
    response = {
      success: true,
      message: 'Gestiones de cobranza obtenidas correctamente',
      gestiones: [],
    };
    gestionCobranzaService = {
      findAll: () => of(response),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: GestionCobranzaService,
          useValue: gestionCobranzaService,
        },
      ],
    });

    service = TestBed.inject(NotificacionTiempoRealService);
  });

  it('mantiene una gestion BAJO como notificacion normal sin alerta interna', () => {
    response.gestiones = [baseGestion];

    service.refresh();

    expect(service.notificaciones()[0]).toMatchObject({
      titulo: 'Aviso preventivo',
      esAlertaInterna: false,
      tipoAlerta: null,
      requiereIntervencionHumana: false,
    });
  });

  it('marca riesgo ALTO como alerta interna de seguimiento prioritario', () => {
    response.gestiones = [
      {
        ...baseGestion,
        id: 2,
        nivelRiesgo: 'ALTO',
        prioridad: 'ALTA',
        accion: 'Seguimiento prioritario',
        alertaInterna: {
          tipo: 'ALERTA_ALTO',
          prioridad: 'ALTA',
          mensaje: 'Cliente: Cliente Prueba',
          accionRecomendada: 'Seguimiento prioritario',
          requiereIntervencionHumana: false,
        },
      },
    ];

    service.refresh();

    expect(service.notificaciones()[0]).toMatchObject({
      titulo: 'Alerta interna',
      prioridad: 'ALTA',
      tipoAlerta: 'ALERTA_ALTO',
      accionRecomendada: 'Seguimiento prioritario',
      esAlertaInterna: true,
      requiereIntervencionHumana: false,
    });
  });

  it('marca riesgo CRITICO como alerta urgente con intervencion humana', () => {
    response.gestiones = [
      {
        ...baseGestion,
        id: 3,
        nivelRiesgo: 'CRITICO',
        prioridad: 'MAXIMA',
        accion: 'Revision critica y contacto urgente',
        alertaInterna: {
          tipo: 'ALERTA_CRITICA',
          prioridad: 'MAXIMA',
          mensaje: 'Cliente: Cliente Prueba',
          accionRecomendada: 'Contacto inmediato y revision manual',
          requiereIntervencionHumana: true,
        },
      },
    ];

    service.refresh();

    expect(service.notificaciones()[0]).toMatchObject({
      titulo: 'Alerta urgente',
      prioridad: 'MAXIMA',
      tipoAlerta: 'ALERTA_CRITICA',
      accionRecomendada: 'Contacto inmediato y revision manual',
      esAlertaInterna: true,
      requiereIntervencionHumana: true,
    });
  });
});
