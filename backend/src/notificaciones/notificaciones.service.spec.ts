/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';

import { NotificacionesService } from './notificaciones.service';

interface WhatsappTemplateRequest {
  template: {
    name: string;
    components?: Array<{
      parameters: Array<{
        text: string;
      }>;
    }>;
  };
}

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  let configService: { get: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          WHATSAPP_ACCESS_TOKEN: '  TOKEN_PRUEBA  ',
          WHATSAPP_PHONE_NUMBER_ID: '  123456789  ',
          WHATSAPP_GRAPH_API_VERSION: 'v26.0',
          WHATSAPP_TEMPLATE_NAME: 'hello_world',
          WHATSAPP_TEMPLATE_ALTO: 'cobranza_riesgo_alto',
          WHATSAPP_TEMPLATE_CRITICO: 'cobranza_riesgo_critico',
          WHATSAPP_TEMPLATE_LANGUAGE: 'en_US',
          WHATSAPP_TEMPLATE_USE_PARAMETERS: 'false',
          WHATSAPP_TEMPLATE_BODY_PARAMETER_COUNT: '0',
          WHATSAPP_SEND_FREE_TEXT: 'false',
        };

        return config[key];
      }),
    };
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    service = new NotificacionesService(
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('envia WhatsApp usando configuracion recortada sin espacios externos', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ messages: [{ id: 'wamid.test' }] }),
    });

    const response = await service.enviarWhatsappPrueba({
      telefono: '0987545679',
      mensaje: 'Prueba',
    });

    expect(response.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v26.0/123456789/messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer TOKEN_PRUEBA',
        }),
      }),
    );
  });

  it('devuelve una explicacion clara cuando Meta rechaza el token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: jest.fn().mockResolvedValue({
        error: {
          message: 'Authentication Error',
          code: 190,
        },
      }),
    });

    const response = await service.enviarWhatsappPrueba({
      telefono: '593987545679',
      mensaje: 'Prueba',
    });

    expect(response.success).toBe(false);
    expect(response.resultado.estado).toBe('ERROR');
    expect(response.resultado.detalle).toContain('code 190');
    expect(response.resultado.detalle).toContain('Token invalido o vencido');
  });

  it('selecciona la plantilla de riesgo ALTO con las 5 variables en orden', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ messages: [{ id: 'wamid.alto' }] }),
    });

    const response = await service.enviarGestion({
      canales: ['WHATSAPP'],
      nivelRiesgo: 'ALTO',
      clienteNombre: 'Cliente Prueba',
      clienteEmail: 'cliente@example.com',
      clienteTelefono: '0987545679',
      asunto: 'CobrosPredictivo - Seguimiento prioritario',
      mensaje: 'Mensaje de correo',
      mensajeWhatsapp: 'Mensaje de WhatsApp',
      cuotaNumero: 3,
      saldoPendiente: 500,
      saldoPendientePrestamo: 1500,
      diasAtraso: 35,
      accion: 'Seguimiento prioritario',
    });
    const [, requestInit] = fetchMock.mock.calls[0] as [
      string,
      { body: string },
    ];
    const body = JSON.parse(requestInit.body) as WhatsappTemplateRequest;

    expect(response[0].estado).toBe('ENVIADO');
    expect(body.template.name).toBe('cobranza_riesgo_alto');
    expect(body.template.components?.[0].parameters).toHaveLength(5);
    expect(
      body.template.components?.[0].parameters.map((item) => item.text),
    ).toEqual(['Cliente Prueba', '3', '500', '35', '1500']);
  });

  it('selecciona la plantilla de riesgo CRITICO con las 5 variables en orden', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        messages: [{ id: 'wamid.critico' }],
      }),
    });

    await service.enviarGestion({
      canales: ['WHATSAPP'],
      nivelRiesgo: 'CRITICO',
      clienteNombre: 'Cliente Critico',
      clienteEmail: 'cliente@example.com',
      clienteTelefono: '593987545679',
      asunto: 'CobrosPredictivo - Revision critica',
      mensaje: 'Mensaje de correo',
      mensajeWhatsapp: 'Mensaje de WhatsApp',
      cuotaNumero: 4,
      saldoPendiente: 750.5,
      saldoPendientePrestamo: 2200.75,
      diasAtraso: 95,
      accion: 'Revision critica',
    });
    const [, requestInit] = fetchMock.mock.calls[0] as [
      string,
      { body: string },
    ];
    const body = JSON.parse(requestInit.body) as WhatsappTemplateRequest;

    expect(body.template.name).toBe('cobranza_riesgo_critico');
    expect(body.template.components?.[0].parameters).toHaveLength(5);
    expect(
      body.template.components?.[0].parameters.map((item) => item.text),
    ).toEqual(['Cliente Critico', '4', '750.5', '95', '2200.75']);
  });

  it('no intenta enviar WhatsApp para riesgo BAJO', async () => {
    const response = await service.enviarGestion({
      canales: ['WHATSAPP'],
      nivelRiesgo: 'BAJO',
      clienteNombre: 'Cliente Bajo',
      clienteEmail: 'cliente@example.com',
      clienteTelefono: '0987545679',
      asunto: 'CobrosPredictivo - Aviso preventivo',
      mensaje: 'Mensaje de correo',
      cuotaNumero: 1,
      saldoPendiente: 100,
      saldoPendientePrestamo: 100,
      diasAtraso: 0,
      accion: 'Aviso preventivo',
    });

    expect(response).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no intenta enviar WhatsApp para riesgo MEDIO', async () => {
    const response = await service.enviarGestion({
      canales: ['WHATSAPP'],
      nivelRiesgo: 'MEDIO',
      clienteNombre: 'Cliente Medio',
      clienteEmail: 'cliente@example.com',
      clienteTelefono: '0987545679',
      asunto: 'CobrosPredictivo - Recordatorio',
      mensaje: 'Mensaje de correo',
      cuotaNumero: 2,
      saldoPendiente: 200,
      saldoPendientePrestamo: 400,
      diasAtraso: 10,
      accion: 'Recordatorio de mora temprana',
    });

    expect(response).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no usa la plantilla global si falta la plantilla de riesgo ALTO', async () => {
    configService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        WHATSAPP_ACCESS_TOKEN: 'TOKEN_PRUEBA',
        WHATSAPP_PHONE_NUMBER_ID: '123456789',
        WHATSAPP_GRAPH_API_VERSION: 'v26.0',
        WHATSAPP_TEMPLATE_NAME: 'jaspers_market_order_confirmation_v1',
        WHATSAPP_TEMPLATE_CRITICO: 'cobranza_riesgo_critico',
        WHATSAPP_TEMPLATE_LANGUAGE: 'es',
        WHATSAPP_SEND_FREE_TEXT: 'false',
      };

      return config[key];
    });

    const response = await service.enviarGestion({
      canales: ['WHATSAPP'],
      nivelRiesgo: 'ALTO',
      clienteNombre: 'Cliente Alto',
      clienteEmail: 'cliente@example.com',
      clienteTelefono: '0987545679',
      asunto: 'CobrosPredictivo - Seguimiento',
      mensaje: 'Mensaje',
      cuotaNumero: 3,
      saldoPendiente: 500,
      saldoPendientePrestamo: 1500,
      diasAtraso: 35,
      accion: 'Seguimiento prioritario',
    });

    expect(response[0].estado).toBe('NO_CONFIGURADO');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no usa la plantilla global si falta la plantilla de riesgo CRITICO', async () => {
    configService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        WHATSAPP_ACCESS_TOKEN: 'TOKEN_PRUEBA',
        WHATSAPP_PHONE_NUMBER_ID: '123456789',
        WHATSAPP_GRAPH_API_VERSION: 'v26.0',
        WHATSAPP_TEMPLATE_NAME: 'jaspers_market_order_confirmation_v1',
        WHATSAPP_TEMPLATE_ALTO: 'cobranza_riesgo_alto',
        WHATSAPP_TEMPLATE_LANGUAGE: 'es',
        WHATSAPP_SEND_FREE_TEXT: 'false',
      };

      return config[key];
    });

    const response = await service.enviarGestion({
      canales: ['WHATSAPP'],
      nivelRiesgo: 'CRITICO',
      clienteNombre: 'Cliente Critico',
      clienteEmail: 'cliente@example.com',
      clienteTelefono: '0987545679',
      asunto: 'CobrosPredictivo - Revision critica',
      mensaje: 'Mensaje',
      cuotaNumero: 4,
      saldoPendiente: 900,
      saldoPendientePrestamo: 1800,
      diasAtraso: 100,
      accion: 'Revision critica',
    });

    expect(response[0].estado).toBe('NO_CONFIGURADO');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
