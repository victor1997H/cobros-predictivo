import { Injectable, NotFoundException } from '@nestjs/common';

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

export interface GestionCobranzaResponse {
  success: boolean;
  message: string;
  gestion: GestionCobranza;
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
        gestion: gestionExistente,
      };
    }

    const cliente = cuota.prestamo.cliente;
    const clienteNombre = `${cliente.nombres} ${cliente.apellidos}`;
    const resultados = await this.notificacionesService.enviarGestion({
      canales,
      clienteNombre,
      clienteEmail: cliente.email,
      clienteTelefono: cliente.telefono,
      asunto: `CobrosPredictivo - ${data.accion}`,
      mensaje: data.mensaje,
      cuotaNumero: cuota.numeroCuota,
      saldoPendiente: Number(cuota.saldoPendiente),
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
      mensaje: data.mensaje,
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
