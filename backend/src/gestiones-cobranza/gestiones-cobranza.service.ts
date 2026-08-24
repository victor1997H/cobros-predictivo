import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Cuota } from '../cuotas/entities/cuota.entity';
import { CuotaRepository } from '../cuotas/repositories/cuota.repository';
import {
  CanalNotificacion,
  NotificacionesService,
  ResultadoNotificacion,
} from '../notificaciones/notificaciones.service';
import { CreateGestionCobranzaDto } from './dto/create-gestion-cobranza.dto';
import {
  GestionCobranza,
  GestionEstadoEnvio,
} from './entities/gestion-cobranza.entity';
import { GestionCobranzaRepository } from './repositories/gestion-cobranza.repository';

const TIMEZONE = 'America/Guayaquil';

export type MotivoGestionOmitida =
  | 'CUOTA_YA_PAGADA'
  | 'CUOTA_SIN_SALDO'
  | 'PRESTAMO_SIN_SALDO';

export interface GestionCobranzaResponse {
  success: boolean;
  message: string;
  procesada: boolean;
  gestion: GestionCobranza | null;
  motivo?: MotivoGestionOmitida;
  saldoPendienteActual?: number;
  saldoPendientePrestamo?: number;
}

export interface GestionesCobranzaResponse {
  success: boolean;
  message: string;
  gestiones: GestionCobranza[];
}

@Injectable()
export class GestionesCobranzaService {
  constructor(
    private readonly gestionRepository: GestionCobranzaRepository,
    private readonly cuotaRepository: CuotaRepository,
    private readonly notificacionesService: NotificacionesService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<GestionesCobranzaResponse> {
    const gestiones = await this.gestionRepository.findAll();

    return {
      success: true,
      message: 'Gestiones de cobranza obtenidas correctamente',
      gestiones,
    };
  }

  async create(
    data: CreateGestionCobranzaDto,
  ): Promise<GestionCobranzaResponse> {
    const cuota = await this.findCuotaById(data.cuotaId);
    const saldoPendienteActual = Number(cuota.saldoPendiente);
    const saldoPendientePrestamo = await this.calcularSaldoPendientePrestamo(
      cuota.prestamoId,
    );
    const motivoOmitir = this.obtenerMotivoOmitirGestion(
      cuota,
      saldoPendientePrestamo,
    );

    if (motivoOmitir) {
      return this.crearRespuestaOmitida(
        motivoOmitir,
        saldoPendienteActual,
        saldoPendientePrestamo,
      );
    }

    const fechaGestion =
      data.fechaGestion ?? this.getDateInTimezone(new Date());
    const canales = this.resolveCanales(data.canales);
    const claveGestion = this.crearClaveGestion(
      fechaGestion,
      data.cuotaId,
      data.accion,
    );
    const gestionExistente =
      await this.gestionRepository.findByClaveGestion(claveGestion);

    if (gestionExistente) {
      return {
        success: true,
        message: 'La gestion ya fue registrada previamente',
        procesada: true,
        gestion: gestionExistente,
      };
    }

    const cliente = cuota.prestamo.cliente;
    const clienteNombre = `${cliente.nombres} ${cliente.apellidos}`;
    const mensaje = this.sincronizarSaldoEnMensaje(
      data.mensaje,
      saldoPendienteActual,
    );
    const resultados = await this.notificacionesService.enviarGestion({
      canales,
      clienteNombre,
      clienteEmail: cliente.email,
      clienteTelefono: cliente.telefono,
      asunto: `CobrosPredictivo - ${data.accion}`,
      mensaje,
      cuotaNumero: cuota.numeroCuota,
      saldoPendiente: saldoPendienteActual,
      diasAtraso: data.diasAtraso,
      accion: data.accion,
    });

    const gestion = this.gestionRepository.create({
      claveGestion,
      cuota,
      cuotaId: cuota.id,
      fechaGestion,
      tipoGestion: data.tipoGestion,
      diasAtraso: data.diasAtraso,
      nivelRiesgo: data.nivelRiesgo,
      prioridad: data.prioridad,
      accion: data.accion,
      mensaje,
      modo: data.modo ?? 'Produccion',
      clienteNombre,
      clienteEmail: cliente.email,
      clienteTelefono: cliente.telefono,
      canalesSolicitados: canales,
      estadoEnvio: this.calcularEstadoEnvio(resultados),
      resultadoEnvio: resultados,
    });
    const savedGestion = await this.gestionRepository.save(gestion);

    return {
      success: true,
      message: 'Gestion de cobranza registrada correctamente',
      procesada: true,
      gestion: savedGestion,
    };
  }

  private async findCuotaById(id: number): Promise<Cuota> {
    const cuota = await this.cuotaRepository.findById(id);

    if (!cuota) {
      throw new NotFoundException('Cuota no encontrada');
    }

    return cuota;
  }

  private async calcularSaldoPendientePrestamo(
    prestamoId: number,
  ): Promise<number> {
    const cuotas = await this.dataSource.getRepository(Cuota).find({
      where: { prestamoId },
      select: {
        id: true,
        saldoPendiente: true,
      },
    });

    return cuotas.reduce(
      (total, cuota) =>
        Number((total + Number(cuota.saldoPendiente)).toFixed(2)),
      0,
    );
  }

  private obtenerMotivoOmitirGestion(
    cuota: Cuota,
    saldoPendientePrestamo: number,
  ): MotivoGestionOmitida | null {
    if (cuota.estado === 'PAGADA') {
      return 'CUOTA_YA_PAGADA';
    }

    if (Number(cuota.saldoPendiente) <= 0) {
      return 'CUOTA_SIN_SALDO';
    }

    if (saldoPendientePrestamo <= 0) {
      return 'PRESTAMO_SIN_SALDO';
    }

    return null;
  }

  private crearRespuestaOmitida(
    motivo: MotivoGestionOmitida,
    saldoPendienteActual: number,
    saldoPendientePrestamo: number,
  ): GestionCobranzaResponse {
    return {
      success: true,
      message: this.getMensajeGestionOmitida(motivo),
      procesada: false,
      motivo,
      saldoPendienteActual,
      saldoPendientePrestamo,
      gestion: null,
    };
  }

  private getMensajeGestionOmitida(motivo: MotivoGestionOmitida): string {
    const mensajes: Record<MotivoGestionOmitida, string> = {
      CUOTA_YA_PAGADA:
        'Gestion omitida porque la cuota ya se encuentra pagada',
      CUOTA_SIN_SALDO:
        'Gestion omitida porque la cuota no tiene saldo pendiente',
      PRESTAMO_SIN_SALDO:
        'Gestion omitida porque el prestamo no tiene saldo pendiente',
    };

    return mensajes[motivo];
  }

  private sincronizarSaldoEnMensaje(
    mensaje: string,
    saldoPendienteActual: number,
  ): string {
    return mensaje.replace(
      /(saldo pendiente(?: de)?\s*:?\s*\$)\d+(?:[.,]\d+)?/gi,
      `$1${this.formatearMonto(saldoPendienteActual)}`,
    );
  }

  private formatearMonto(value: number): string {
    return String(Number(value.toFixed(2)));
  }

  private resolveCanales(canales?: CanalNotificacion[]): CanalNotificacion[] {
    if (!canales || canales.length === 0) {
      return ['CORREO', 'WHATSAPP'];
    }

    return Array.from(new Set(canales));
  }

  private calcularEstadoEnvio(
    resultados: ResultadoNotificacion[],
  ): GestionEstadoEnvio {
    if (resultados.length === 0) {
      return 'NO_CONFIGURADO';
    }

    const enviados = resultados.filter(
      (item) => item.estado === 'ENVIADO',
    ).length;
    const noConfigurados = resultados.every(
      (item) => item.estado === 'NO_CONFIGURADO',
    );

    if (enviados === resultados.length) {
      return 'ENVIADO';
    }

    if (enviados > 0) {
      return 'PARCIAL';
    }

    return noConfigurados ? 'NO_CONFIGURADO' : 'ERROR';
  }

  private crearClaveGestion(
    fechaGestion: string,
    cuotaId: number,
    accion: string,
  ): string {
    const accionNormalizada = accion
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return `${fechaGestion}:${cuotaId}:${accionNormalizada}`;
  }

  private getDateInTimezone(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new Error('No se pudo calcular la fecha de gestion');
    }

    return `${year}-${month}-${day}`;
  }
}
