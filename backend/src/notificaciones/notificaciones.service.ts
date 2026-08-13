import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

import { EnviarCorreoPruebaDto } from './dto/enviar-correo-prueba.dto';
import { EnviarWhatsappPruebaDto } from './dto/enviar-whatsapp-prueba.dto';

export type CanalNotificacion = 'CORREO' | 'WHATSAPP';
export type EstadoNotificacion = 'ENVIADO' | 'ERROR' | 'NO_CONFIGURADO';

export interface NotificacionGestionPayload {
  canales: CanalNotificacion[];
  clienteNombre: string;
  clienteEmail: string;
  clienteTelefono: string;
  asunto: string;
  mensaje: string;
  cuotaNumero: number;
  saldoPendiente: number;
  diasAtraso: number;
  accion: string;
}

export interface ResultadoNotificacion {
  canal: CanalNotificacion;
  estado: EstadoNotificacion;
  detalle: string;
  proveedor: string;
  fecha: string;
}

@Injectable()
export class NotificacionesService {
  constructor(private readonly configService: ConfigService) {}

  async enviarCorreoPrueba(data: EnviarCorreoPruebaDto) {
    const asunto =
      data.asunto ?? 'CobrosPredictivo - prueba de correo automatico';
    const mensaje =
      data.mensaje ??
      'Este correo confirma que CobrosPredictivo puede enviar notificaciones automaticas desde el backend.';
    const resultado = await this.enviarCorreo({
      canales: ['CORREO'],
      clienteNombre: 'Prueba de correo',
      clienteEmail: data.destinatario,
      clienteTelefono: '',
      asunto,
      mensaje,
      cuotaNumero: 0,
      saldoPendiente: 0,
      diasAtraso: 0,
      accion: 'Prueba de correo automatico',
    });

    return {
      success: resultado.estado === 'ENVIADO',
      message:
        resultado.estado === 'ENVIADO'
          ? 'Correo de prueba enviado correctamente'
          : 'No se pudo enviar el correo de prueba',
      resultado,
    };
  }

  async enviarWhatsappPrueba(data: EnviarWhatsappPruebaDto) {
    const mensaje =
      data.mensaje ??
      'Prueba real de WhatsApp automatico desde CobrosPredictivo.';
    const resultado = await this.enviarWhatsapp({
      canales: ['WHATSAPP'],
      clienteNombre: 'Prueba de WhatsApp',
      clienteEmail: '',
      clienteTelefono: data.telefono,
      asunto: 'CobrosPredictivo - prueba de WhatsApp',
      mensaje,
      cuotaNumero: 0,
      saldoPendiente: 0,
      diasAtraso: 0,
      accion: 'Prueba de WhatsApp automatico',
    });

    return {
      success: resultado.estado === 'ENVIADO',
      message:
        resultado.estado === 'ENVIADO'
          ? 'Mensaje de WhatsApp enviado correctamente'
          : 'No se pudo enviar el mensaje de WhatsApp',
      resultado,
    };
  }

  async enviarGestion(
    payload: NotificacionGestionPayload,
  ): Promise<ResultadoNotificacion[]> {
    const canales = new Set(payload.canales);
    const resultados: ResultadoNotificacion[] = [];

    if (canales.has('CORREO')) {
      resultados.push(await this.enviarCorreo(payload));
    }

    if (canales.has('WHATSAPP')) {
      resultados.push(await this.enviarWhatsapp(payload));
    }

    return resultados;
  }

  enviarCorreoSistema(data: {
    destinatario: string;
    asunto: string;
    mensaje: string;
  }): Promise<ResultadoNotificacion> {
    return this.enviarCorreo({
      canales: ['CORREO'],
      clienteNombre: 'Usuario del sistema',
      clienteEmail: data.destinatario,
      clienteTelefono: '',
      asunto: data.asunto,
      mensaje: data.mensaje,
      cuotaNumero: 0,
      saldoPendiente: 0,
      diasAtraso: 0,
      accion: 'Correo del sistema',
    });
  }

  private async enviarCorreo(
    payload: NotificacionGestionPayload,
  ): Promise<ResultadoNotificacion> {
    const host = this.getConfigValue('SMTP_HOST');
    const port = Number(this.getConfigValue('SMTP_PORT') ?? 587);
    const secure = this.getConfigValue('SMTP_SECURE') === 'true';
    const user = this.getConfigValue('SMTP_USER');
    const pass = this.normalizeSmtpPassword(
      this.getConfigValue('SMTP_PASSWORD'),
      host,
    );
    const from = this.getConfigValue('SMTP_FROM') ?? user;

    if (!host || !from || !payload.clienteEmail || (user && !pass)) {
      return this.resultado(
        'CORREO',
        'NO_CONFIGURADO',
        'Faltan SMTP_HOST, SMTP_FROM, SMTP_PASSWORD o correo del cliente.',
        'SMTP',
      );
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: user && pass ? { user, pass } : undefined,
      });

      await transporter.sendMail({
        from,
        to: payload.clienteEmail,
        subject: payload.asunto,
        text: payload.mensaje,
        html: this.toHtml(payload.mensaje),
      });

      return this.resultado(
        'CORREO',
        'ENVIADO',
        `Correo enviado a ${payload.clienteEmail}.`,
        'SMTP',
      );
    } catch (error) {
      return this.resultado(
        'CORREO',
        'ERROR',
        this.getErrorMessage(error),
        'SMTP',
      );
    }
  }

  private async enviarWhatsapp(
    payload: NotificacionGestionPayload,
  ): Promise<ResultadoNotificacion> {
    const token = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.configService.get<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
    );
    const apiVersion =
      this.configService.get<string>('WHATSAPP_GRAPH_API_VERSION') ?? 'v26.0';
    const templateName = this.configService.get<string>(
      'WHATSAPP_TEMPLATE_NAME',
    );
    const templateLanguage =
      this.configService.get<string>('WHATSAPP_TEMPLATE_LANGUAGE') ?? 'es';
    const useTemplateParameters =
      this.configService.get<string>('WHATSAPP_TEMPLATE_USE_PARAMETERS') ===
      'true';
    const templateBodyParameterCount = this.getTemplateBodyParameterCount(
      useTemplateParameters,
    );
    const allowFreeText =
      this.configService.get<string>('WHATSAPP_SEND_FREE_TEXT') === 'true';
    const telefono = this.normalizarTelefono(payload.clienteTelefono);

    if (!token || !phoneNumberId || !telefono) {
      return this.resultado(
        'WHATSAPP',
        'NO_CONFIGURADO',
        'Faltan WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID o telefono del cliente.',
        'WhatsApp Cloud API',
      );
    }

    if (!templateName && !allowFreeText) {
      return this.resultado(
        'WHATSAPP',
        'NO_CONFIGURADO',
        'Falta plantilla aprobada de WhatsApp o WHATSAPP_SEND_FREE_TEXT=true para pruebas controladas.',
        'WhatsApp Cloud API',
      );
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const body = templateName
      ? this.crearMensajePlantilla(
          payload,
          telefono,
          templateName,
          templateLanguage,
          useTemplateParameters,
          templateBodyParameterCount,
        )
      : this.crearMensajeTexto(payload, telefono);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as unknown;

      if (!response.ok) {
        return this.resultado(
          'WHATSAPP',
          'ERROR',
          this.getProviderMessage(data),
          'WhatsApp Cloud API',
        );
      }

      return this.resultado(
        'WHATSAPP',
        'ENVIADO',
        `Mensaje enviado a ${telefono}.`,
        'WhatsApp Cloud API',
      );
    } catch (error) {
      return this.resultado(
        'WHATSAPP',
        'ERROR',
        this.getErrorMessage(error),
        'WhatsApp Cloud API',
      );
    }
  }

  private crearMensajeTexto(
    payload: NotificacionGestionPayload,
    telefono: string,
  ) {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefono,
      type: 'text',
      text: {
        preview_url: false,
        body: payload.mensaje,
      },
    };
  }

  private crearMensajePlantilla(
    payload: NotificacionGestionPayload,
    telefono: string,
    templateName: string,
    templateLanguage: string,
    useTemplateParameters: boolean,
    templateBodyParameterCount: number,
  ) {
    const template: Record<string, unknown> = {
      name: templateName,
      language: {
        code: templateLanguage,
      },
    };

    if (useTemplateParameters) {
      const parameters = [
        { type: 'text', text: payload.clienteNombre },
        { type: 'text', text: payload.accion },
        { type: 'text', text: String(payload.cuotaNumero) },
        { type: 'text', text: String(payload.saldoPendiente) },
        { type: 'text', text: String(payload.diasAtraso) },
      ];

      template.components = [
        {
          type: 'body',
          parameters: parameters.slice(0, templateBodyParameterCount),
        },
      ];
    }

    return {
      messaging_product: 'whatsapp',
      to: telefono,
      type: 'template',
      template,
    };
  }

  private normalizarTelefono(telefono: string): string {
    const digits = telefono.replace(/\D/g, '');

    if (digits.startsWith('0') && digits.length === 10) {
      return `593${digits.slice(1)}`;
    }

    return digits;
  }

  private getTemplateBodyParameterCount(useTemplateParameters: boolean): number {
    if (!useTemplateParameters) {
      return 0;
    }

    const value = this.configService.get<string>(
      'WHATSAPP_TEMPLATE_BODY_PARAMETER_COUNT',
    );
    const count = Number(value ?? 5);

    if (!Number.isFinite(count) || count < 0) {
      return 5;
    }

    return Math.floor(count);
  }

  private resultado(
    canal: CanalNotificacion,
    estado: EstadoNotificacion,
    detalle: string,
    proveedor: string,
  ): ResultadoNotificacion {
    return {
      canal,
      estado,
      detalle,
      proveedor,
      fecha: new Date().toISOString(),
    };
  }

  private toHtml(message: string): string {
    return `<p>${this.escapeHtml(message).replace(/\n/g, '<br>')}</p>`;
  }

  private getConfigValue(key: string): string | undefined {
    return this.configService.get<string>(key)?.trim();
  }

  private normalizeSmtpPassword(
    password: string | undefined,
    host: string | undefined,
  ): string | undefined {
    if (!password) {
      return undefined;
    }

    if (host?.includes('gmail.com')) {
      return password.replace(/\s+/g, '');
    }

    return password;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private getProviderMessage(data: unknown): string {
    if (
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'object' &&
      data.error !== null &&
      'message' in data.error &&
      typeof data.error.message === 'string'
    ) {
      return data.error.message;
    }

    return 'El proveedor rechazo la notificacion.';
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Error desconocido';
  }
}
