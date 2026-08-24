import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subscription, finalize, interval } from 'rxjs';

import { GestionCobranzaService } from './gestion-cobranza.service';
import { GestionCobranzaRegistro } from '../../features/cobros/models/gestion-cobranza.model';

export interface NotificacionSistema {
  id: number;
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
  private readonly storageKey = 'cobros_notificaciones_vistas_hasta';
  private readonly refreshMs = 20000;
  private pollingSubscription?: Subscription;

  private readonly gestiones = signal<GestionCobranzaRegistro[]>([]);
  private readonly lastSeenAt = signal(this.loadLastSeenAt());

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly notificaciones = computed<NotificacionSistema[]>(() =>
    this.gestiones()
      .slice(0, 8)
      .map((gestion) => {
        const alerta = gestion.alertaInterna ?? null;

        return {
          id: gestion.id,
          titulo: alerta
            ? alerta.tipo === 'ALERTA_CRITICA'
              ? 'Alerta urgente'
              : 'Alerta interna'
            : gestion.accion,
          detalle: alerta
            ? `${gestion.clienteNombre} - ${alerta.accionRecomendada}`
            : `${gestion.clienteNombre} - ${gestion.estadoEnvio}`,
          estado: gestion.estadoEnvio,
          riesgo: gestion.nivelRiesgo,
          prioridad: alerta?.prioridad ?? gestion.prioridad,
          tipoAlerta: alerta?.tipo ?? null,
          accionRecomendada: alerta?.accionRecomendada ?? null,
          requiereIntervencionHumana: alerta?.requiereIntervencionHumana ?? false,
          esAlertaInterna: alerta !== null,
          fecha: gestion.createdAt,
        };
      }),
  );

  readonly unreadCount = computed(() => {
    const vistoHasta = this.lastSeenAt();

    return this.gestiones().filter((gestion) => new Date(gestion.createdAt).getTime() > vistoHasta)
      .length;
  });

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

  markAsRead(): void {
    const now = Date.now();

    this.lastSeenAt.set(now);
    localStorage.setItem(this.storageKey, String(now));
  }

  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
  }

  private loadLastSeenAt(): number {
    const value = Number(localStorage.getItem(this.storageKey));

    return Number.isFinite(value) ? value : 0;
  }
}
