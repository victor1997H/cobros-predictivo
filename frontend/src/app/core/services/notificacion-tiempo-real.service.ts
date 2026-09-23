import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subscription, finalize, interval } from 'rxjs';

import { GestionCobranzaService } from './gestion-cobranza.service';
import { GestionCobranzaRegistro } from '../../features/cobros/models/gestion-cobranza.model';

export interface NotificacionSistema {
  id: number;
  cuotaId: number;
  leida: boolean;
  titulo: string;
  detalle: string;
  estado: string;
  riesgo: string;
  prioridad: string;
  tipoAlerta: string | null;
  accionRecomendada: string | null;
  requiereIntervencionHumana: boolean;
  esAlertaInterna: boolean;
  fecha: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificacionTiempoRealService implements OnDestroy {
  private readonly gestionCobranzaService = inject(GestionCobranzaService);
  private readonly refreshMs = 15000;
  private readonly readStorageKey = 'cobros_notificaciones_leidas';
  private pollingSubscription?: Subscription;

  private readonly gestiones = signal<GestionCobranzaRegistro[]>([]);
  private readonly readNotificationIds = signal<Set<number>>(
    this.loadReadNotificationIds(),
  );

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly gestionesActivas = computed(() =>
    this.deduplicateActiveGestiones(this.gestiones()),
  );

  readonly notificaciones = computed<NotificacionSistema[]>(() =>
    this.gestionesActivas().slice(0, 8).map((gestion) =>
      this.buildNotification(gestion),
    ),
  );

  readonly unreadAlertCount = computed(() => {
    const readNotificationIds = this.readNotificationIds();

    return this.gestionesActivas().filter(
      (gestion) => !readNotificationIds.has(gestion.id),
    ).length;
  });

  readonly activeAlertCount = this.unreadAlertCount;

  start(): void {
    if (this.pollingSubscription) {
      return;
    }

    this.refresh();
    this.pollingSubscription = interval(this.refreshMs).subscribe(() => this.refresh());
  }

  refresh(): void {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.gestionCobranzaService
      .findAll()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          const gestiones = [...response.gestiones].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );

          this.gestiones.set(gestiones);
        },
        error: () => {
          this.errorMessage.set('No se pudieron actualizar las notificaciones.');
        },
      });
  }

  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
  }

  markAsRead(notificationId: number): void {
    if (this.readNotificationIds().has(notificationId)) {
      return;
    }

    const nextIds = new Set(this.readNotificationIds());

    nextIds.add(notificationId);
    this.readNotificationIds.set(nextIds);
    this.persistReadNotificationIds(nextIds);
  }

  private deduplicateActiveGestiones(
    gestiones: GestionCobranzaRegistro[],
  ): GestionCobranzaRegistro[] {
    const porCuota = new Map<number, GestionCobranzaRegistro>();

    for (const gestion of gestiones) {
      if (!this.isActiveAlert(gestion) || porCuota.has(gestion.cuotaId)) {
        continue;
      }

      porCuota.set(gestion.cuotaId, gestion);
    }

    return [...porCuota.values()];
  }

  private isActiveAlert(gestion: GestionCobranzaRegistro): boolean {
    if (gestion.alertaInterna) {
      return true;
    }

    if (
      gestion.estadoEnvio === 'ERROR' ||
      gestion.estadoEnvio === 'PARCIAL' ||
      gestion.estadoEnvio === 'NO_CONFIGURADO'
    ) {
      return true;
    }

    if (gestion.nivelRiesgo === 'ALTO' || gestion.nivelRiesgo === 'CRITICO') {
      return true;
    }

    return ['VENCIDA', 'VENCE_HOY', 'VENCE_MANANA'].includes(
      gestion.tipoGestion,
    );
  }

  private buildNotification(
    gestion: GestionCobranzaRegistro,
  ): NotificacionSistema {
    const alerta = gestion.alertaInterna ?? null;

    return {
      id: gestion.id,
      cuotaId: gestion.cuotaId,
      leida: this.readNotificationIds().has(gestion.id),
      titulo: this.resolveTitle(gestion),
      detalle: this.resolveDetail(gestion),
      estado: gestion.estadoEnvio,
      riesgo: gestion.nivelRiesgo,
      prioridad: alerta?.prioridad ?? gestion.prioridad,
      tipoAlerta: alerta?.tipo ?? null,
      accionRecomendada: alerta?.accionRecomendada ?? null,
      requiereIntervencionHumana: alerta?.requiereIntervencionHumana ?? false,
      esAlertaInterna: alerta !== null,
      fecha: gestion.createdAt,
    };
  }

  private resolveTitle(gestion: GestionCobranzaRegistro): string {
    if (gestion.alertaInterna?.tipo === 'ALERTA_CRITICA') {
      return 'Alerta urgente';
    }

    if (gestion.alertaInterna?.tipo === 'ALERTA_ALTO') {
      return 'Seguimiento prioritario';
    }

    if (
      gestion.estadoEnvio === 'ERROR' ||
      gestion.estadoEnvio === 'PARCIAL' ||
      gestion.estadoEnvio === 'NO_CONFIGURADO'
    ) {
      return 'Gestion pendiente';
    }

    if (gestion.tipoGestion === 'VENCE_HOY') {
      return 'Vence hoy';
    }

    if (gestion.tipoGestion === 'VENCE_MANANA') {
      return 'Vence manana';
    }

    if (gestion.tipoGestion === 'VENCIDA') {
      return 'Cuota vencida';
    }

    return gestion.accion;
  }

  private resolveDetail(gestion: GestionCobranzaRegistro): string {
    const dias =
      gestion.diasAtraso > 0
        ? `${gestion.diasAtraso} dias de mora`
        : 'Sin mora';
    const canal = this.formatCanales(gestion.canalesSolicitados);

    if (gestion.alertaInterna?.accionRecomendada) {
      return `${gestion.clienteNombre} - ${dias} - ${gestion.alertaInterna.accionRecomendada}`;
    }

    return `${gestion.clienteNombre} - ${dias} - ${canal}`;
  }

  private formatCanales(canales: GestionCobranzaRegistro['canalesSolicitados']): string {
    if (!canales.length) {
      return 'Sin aviso registrado';
    }

    return [...new Set(canales)]
      .map((canal) => (canal === 'CORREO' ? 'Correo' : 'WhatsApp'))
      .join(' + ');
  }

  private loadReadNotificationIds(): Set<number> {
    const storedValue = localStorage.getItem(this.readStorageKey);

    if (!storedValue) {
      return new Set<number>();
    }

    try {
      const values = JSON.parse(storedValue) as unknown;

      if (!Array.isArray(values)) {
        return new Set<number>();
      }

      return new Set(
        values.filter((value): value is number => typeof value === 'number'),
      );
    } catch {
      return new Set<number>();
    }
  }

  private persistReadNotificationIds(notificationIds: Set<number>): void {
    localStorage.setItem(this.readStorageKey, JSON.stringify([...notificationIds]));
  }
}
