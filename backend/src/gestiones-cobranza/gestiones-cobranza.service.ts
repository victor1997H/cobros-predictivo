import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Cuota } from '../cuotas/entities/cuota.entity';
import { CuotaRepository } from '../cuotas/repositories/cuota.repository';
import {
  CategoriaReferencia,
  clasificarCategoriaMorosidad,
} from '../cuotas/riesgo/nivel-riesgo';
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
  'CUOTA_YA_PAGADA' | 'CUOTA_SIN_SALDO' | 'PRESTAMO_SIN_SALDO';

export type TipoAlertaInterna = 'ALERTA_ALTO' | 'ALERTA_CRITICA';

export interface AlertaInternaGestion {
  tipo: TipoAlertaInterna;
  prioridad: string;
  mensaje: string;
  accionRecomendada: string;
  requiereIntervencionHumana: boolean;
}

export type GestionCobranzaConAlerta = GestionCobranza & {
  categoriaReferencia: CategoriaReferencia;
  alertaInterna: AlertaInternaGestion | null;
};

export interface GestionCobranzaResponse {
  success: boolean;
  message: string;
  procesada: boolean;
  gestion: GestionCobranzaConAlerta | null;
  motivo?: MotivoGestionOmitida;
  saldoPendienteActual?: number;
  saldoPendientePrestamo?: number;
}

export interface GestionesCobranzaResponse {
  success: boolean;
  message: string;
  gestiones: GestionCobranzaConAlerta[];
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
    const gestionesConAlerta = await this.agregarAlertasInternas(gestiones);

    return {
      success: true,
      message: 'Gestiones de cobranza obtenidas correctamente',
      gestiones: gestionesConAlerta,
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
    const cliente = cuota.prestamo.cliente;
    const clienteNombre = `${cliente.nombres} ${cliente.apellidos}`;
    const mensaje = this.sincronizarSaldosEnMensaje(
      data.mensaje,
      saldoPendienteActual,
      saldoPendientePrestamo,
    );
    const mensajeWhatsapp = data.mensajeWhatsapp
      ? this.sincronizarSaldosEnMensaje(
          data.mensajeWhatsapp,
          saldoPendienteActual,
          saldoPendientePrestamo,
        )
      : undefined;
    const payloadNotificacion = {
      clienteNombre,
      clienteEmail: cliente.email,
      clienteTelefono: cliente.telefono,
      asunto: `CobrosPredictivo - ${data.accion}`,
      mensaje,
      mensajeWhatsapp,
      cuotaNumero: cuota.numeroCuota,
      saldoPendiente: saldoPendienteActual,
      diasAtraso: data.diasAtraso,
      accion: data.accion,
    };
    const gestionExistente =
      await this.gestionRepository.findByClaveGestion(claveGestion);

    if (gestionExistente) {
      const canalesPendientes = this.obtenerCanalesPendientes(
        canales,
        gestionExistente.resultadoEnvio,
      );

      if (canalesPendientes.length > 0) {
        const resultadosReintento =
          await this.notificacionesService.enviarGestion({
            canales: canalesPendientes,
            ...payloadNotificacion,
          });

        gestionExistente.canalesSolicitados = this.combinarCanales(
          gestionExistente.canalesSolicitados,
          canales,
        );
        gestionExistente.resultadoEnvio = this.combinarResultadosEnvio(
          gestionExistente.resultadoEnvio,
          resultadosReintento,
          gestionExistente.canalesSolicitados,
        );
        gestionExistente.estadoEnvio = this.calcularEstadoEnvio(
          gestionExistente.resultadoEnvio,
        );

        const gestionActualizada =
          await this.gestionRepository.save(gestionExistente);

        return {
          success: true,
          message: 'Gestion existente actualizada con reintentos pendientes',
          procesada: true,
          gestion: this.agregarAlertaInternaConSaldo(
            gestionActualizada,
            saldoPendientePrestamo,
          ),
        };
      }

      return {
        success: true,
        message: 'La gestion ya fue registrada previamente',
        procesada: true,
        gestion: await this.agregarAlertaInterna(gestionExistente),
      };
    }

    const resultados = await this.notificacionesService.enviarGestion({
      canales,
      ...payloadNotificacion,
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
      gestion: this.agregarAlertaInternaConSaldo(
        savedGestion,
        saldoPendientePrestamo,
      ),
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

  private async calcularSaldoPendientePrestamos(
    prestamoIds: number[],
  ): Promise<Map<number, number>> {
    if (prestamoIds.length === 0) {
      return new Map();
    }

    const rows = await this.dataSource
      .getRepository(Cuota)
      .createQueryBuilder('cuota')
      .select('cuota.prestamoId', 'prestamoId')
      .addSelect('COALESCE(SUM(cuota.saldoPendiente), 0)', 'saldoPendiente')
      .where('cuota.prestamoId IN (:...prestamoIds)', { prestamoIds })
      .groupBy('cuota.prestamoId')
      .getRawMany<{ prestamoId: string; saldoPendiente: string }>();

    return new Map(
      rows.map((row) => [
        Number(row.prestamoId),
        Number(Number(row.saldoPendiente).toFixed(2)),
      ]),
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
      CUOTA_YA_PAGADA: 'Gestion omitida porque la cuota ya se encuentra pagada',
      CUOTA_SIN_SALDO:
        'Gestion omitida porque la cuota no tiene saldo pendiente',
      PRESTAMO_SIN_SALDO:
        'Gestion omitida porque el prestamo no tiene saldo pendiente',
    };

    return mensajes[motivo];
  }

  private async agregarAlertasInternas(
    gestiones: GestionCobranza[],
  ): Promise<GestionCobranzaConAlerta[]> {
    const prestamoIds = Array.from(
      new Set(
        gestiones
          .map((gestion) => gestion.cuota?.prestamoId)
          .filter(
            (prestamoId): prestamoId is number =>
              typeof prestamoId === 'number',
          ),
      ),
    );
    const saldosPorPrestamo =
      await this.calcularSaldoPendientePrestamos(prestamoIds);

    return gestiones.map((gestion) =>
      this.agregarAlertaInternaConSaldo(
        gestion,
        saldosPorPrestamo.get(gestion.cuota?.prestamoId ?? 0) ?? 0,
      ),
    );
  }

  private async agregarAlertaInterna(
    gestion: GestionCobranza,
  ): Promise<GestionCobranzaConAlerta> {
    const saldoPendientePrestamo = gestion.cuota
      ? await this.calcularSaldoPendientePrestamo(gestion.cuota.prestamoId)
      : 0;

    return this.agregarAlertaInternaConSaldo(gestion, saldoPendientePrestamo);
  }

  private agregarAlertaInternaConSaldo(
    gestion: GestionCobranza,
    saldoPendientePrestamo: number,
  ): GestionCobranzaConAlerta {
    return Object.assign(gestion, {
      categoriaReferencia: this.obtenerCategoriaReferencia(gestion),
      alertaInterna: this.crearAlertaInterna(gestion, saldoPendientePrestamo),
    });
  }

  private obtenerCategoriaReferencia(
    gestion: GestionCobranza,
  ): CategoriaReferencia {
    return gestion.tipoGestion === 'VENCE_MANANA'
      ? 'PREVENTIVO'
      : clasificarCategoriaMorosidad(gestion.diasAtraso);
  }

  private crearAlertaInterna(
    gestion: GestionCobranza,
    saldoPendientePrestamo: number,
  ): AlertaInternaGestion | null {
    const nivelRiesgo = gestion.nivelRiesgo.toUpperCase();

    if (nivelRiesgo !== 'ALTO' && nivelRiesgo !== 'CRITICO') {
      return null;
    }

    const esCritico = nivelRiesgo === 'CRITICO';

    return {
      tipo: esCritico ? 'ALERTA_CRITICA' : 'ALERTA_ALTO',
      prioridad: esCritico ? 'MAXIMA' : 'ALTA',
      mensaje: this.crearMensajeAlertaInterna(gestion, saldoPendientePrestamo),
      accionRecomendada: esCritico
        ? 'Contacto inmediato y revision manual'
        : 'Seguimiento prioritario',
      requiereIntervencionHumana: esCritico,
    };
  }

  private crearMensajeAlertaInterna(
    gestion: GestionCobranza,
    saldoPendientePrestamo: number,
  ): string {
    const cuota = gestion.cuota;
    const numeroCuota = cuota?.numeroCuota ?? gestion.cuotaId;
    const saldoCuota = this.formatearMonto(Number(cuota?.saldoPendiente ?? 0));
    const saldoPrestamo = this.formatearMonto(saldoPendientePrestamo);

    return [
      `Cliente: ${gestion.clienteNombre}`,
      `Cuota: ${numeroCuota}`,
      `Saldo cuota: $${saldoCuota}`,
      `Saldo prestamo: $${saldoPrestamo}`,
      `Dias de mora: ${gestion.diasAtraso}`,
    ].join('\n');
  }

  private sincronizarSaldosEnMensaje(
    mensaje: string,
    saldoPendienteActual: number,
    saldoPendientePrestamo: number,
  ): string {
    const saldoCuota = this.formatearMonto(saldoPendienteActual);
    const saldoPrestamo = this.formatearMonto(saldoPendientePrestamo);

    return mensaje
      .replace(
        /(saldo pendiente(?:\s+actual)?(?:\s+de|\s+del)?\s+(?:su\s+)?prestamo\s*:?\s*\n?\s*\$)\d+(?:[.,]\d+)?/gi,
        `$1${saldoPrestamo}`,
      )
      .replace(
        /(saldo pendiente total(?:\s+del\s+prestamo)?\s*:?\s*\n?\s*\$)\d+(?:[.,]\d+)?/gi,
        `$1${saldoPrestamo}`,
      )
      .replace(
        /(saldo pendiente(?:\s+de\s+la\s+cuota)?\s*(?:de|:)?\s*\$)\d+(?:[.,]\d+)?/gi,
        `$1${saldoCuota}`,
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

  private obtenerCanalesPendientes(
    canalesSolicitados: CanalNotificacion[],
    resultadosPrevios: ResultadoNotificacion[] | null,
  ): CanalNotificacion[] {
    const estadoPorCanal = new Map(
      (resultadosPrevios ?? []).map((resultado) => [
        resultado.canal,
        resultado.estado,
      ]),
    );

    return canalesSolicitados.filter(
      (canal) => estadoPorCanal.get(canal) !== 'ENVIADO',
    );
  }

  private combinarCanales(
    canalesActuales: CanalNotificacion[],
    canalesNuevos: CanalNotificacion[],
  ): CanalNotificacion[] {
    return this.ordenarCanales([...canalesActuales, ...canalesNuevos]);
  }

  private combinarResultadosEnvio(
    resultadosPrevios: ResultadoNotificacion[] | null,
    resultadosNuevos: ResultadoNotificacion[],
    canalesSolicitados: CanalNotificacion[],
  ): ResultadoNotificacion[] {
    const resultadoPorCanal = new Map<
      CanalNotificacion,
      ResultadoNotificacion
    >();

    for (const resultado of resultadosPrevios ?? []) {
      resultadoPorCanal.set(resultado.canal, resultado);
    }

    for (const resultado of resultadosNuevos) {
      resultadoPorCanal.set(resultado.canal, resultado);
    }

    const canales = this.ordenarCanales([
      ...canalesSolicitados,
      ...resultadoPorCanal.keys(),
    ]);

    return canales.flatMap((canal) => {
      const resultado = resultadoPorCanal.get(canal);

      return resultado ? [resultado] : [];
    });
  }

  private ordenarCanales(canales: CanalNotificacion[]): CanalNotificacion[] {
    const canalesUnicos = new Set(canales);
    const orden: CanalNotificacion[] = ['CORREO', 'WHATSAPP'];

    return orden.filter((canal) => canalesUnicos.has(canal));
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
