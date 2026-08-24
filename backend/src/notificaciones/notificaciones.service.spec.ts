/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';

import { NotificacionesService } from './notificaciones.service';

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
});
