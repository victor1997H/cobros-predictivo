import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { finalize, forkJoin } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { ClienteService } from '../../../../core/services/cliente.service';
import { CobroService } from '../../../../core/services/cobro.service';
import { GestionCobranzaService } from '../../../../core/services/gestion-cobranza.service';
import { PagoService } from '../../../../core/services/pago.service';
import { Cliente } from '../../../clientes/models/cliente.model';
import { CobroGestion } from '../../../cobros/models/cobro.model';
import { GestionCobranzaRegistro } from '../../../cobros/models/gestion-cobranza.model';
import { PagoDetalle } from '../../../pagos/models/pago.model';

@Component({
  selector: 'app-dashboard-home',
  imports: [AsyncPipe],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHome implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly clienteService = inject(ClienteService);
  private readonly cobroService = inject(CobroService);
  private readonly gestionCobranzaService = inject(GestionCobranzaService);
  private readonly pagoService = inject(PagoService);

  readonly currentUser$ = this.authService.currentUser$;
  readonly clientes = signal<Cliente[]>([]);
  readonly cuotasGestion = signal<CobroGestion[]>([]);
  readonly gestiones = signal<GestionCobranzaRegistro[]>([]);
  readonly pagos = signal<PagoDetalle[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly totalClientes = computed(() => this.clientes().length);
  readonly clientesActivos = computed(
    () => this.clientes().filter((cliente) => cliente.estado).length,
  );
  readonly clientesInactivos = computed(
    () => this.clientes().filter((cliente) => !cliente.estado).length,
  );
  readonly ultimosClientes = computed(() => this.clientes().slice(0, 5));
  readonly cuotasVencidas = computed(
    () => this.cuotasGestion().filter((item) => item.tipoGestion === 'VENCIDA').length,
  );
  readonly saldoEnGestion = computed(() =>
    this.cuotasGestion().reduce((total, item) => total + item.cuota.saldoPendiente, 0),
  );
  readonly riesgoCritico = computed(
    () => this.cuotasGestion().filter((item) => item.nivelRiesgo === 'CRITICO').length,
  );
  readonly alertasOperador = computed(
    () => this.gestiones().filter((gestion) => gestion.alertaInterna).length,
  );
  readonly intervencionesHumanas = computed(
    () =>
      this.gestiones().filter((gestion) => gestion.alertaInterna?.requiereIntervencionHumana)
        .length,
  );
  readonly totalRecaudado = computed(() =>
    this.pagos().reduce((total, item) => total + item.pago.monto, 0),
  );
  readonly ultimasGestiones = computed(() => this.gestiones().slice(0, 5));

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    forkJoin({
      clientes: this.clienteService.findAll(),
      gestion: this.cobroService.findGestionCobranza(),
      gestiones: this.gestionCobranzaService.findAll(),
      pagos: this.pagoService.findAll(),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ clientes, gestion, gestiones, pagos }) => {
          this.clientes.set(clientes.clientes);
          this.cuotasGestion.set(gestion.cuotas);
          this.gestiones.set(gestiones.gestiones);
          this.pagos.set(pagos.pagos);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  fullName(cliente: Cliente): string {
    return `${cliente.nombres} ${cliente.apellidos}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  alertaOperadorLabel(gestion: GestionCobranzaRegistro): string {
    if (!gestion.alertaInterna) {
      return '';
    }

    return gestion.alertaInterna.requiereIntervencionHumana
      ? 'Atencion inmediata'
      : 'Seguimiento prioritario';
  }

  categoriaReferenciaLabel(gestion: GestionCobranzaRegistro): string {
    if (!gestion.categoriaReferencia) {
      return 'Sin categoria';
    }

    return gestion.categoriaReferencia === 'PREVENTIVO'
      ? 'Preventivo'
      : `Categoria ${gestion.categoriaReferencia}`;
  }

  private resolveErrorMessage(error: unknown): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'TimeoutError'
    ) {
      return 'La solicitud tard\u00f3 demasiado. Verifica la conexi\u00f3n e intenta nuevamente.';
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof error.error === 'object' &&
      error.error !== null &&
      'message' in error.error
    ) {
      const message = error.error.message;

      if (Array.isArray(message)) {
        return message.join(', ');
      }

      if (typeof message === 'string') {
        return message;
      }
    }

    return 'No se pudo cargar la informaci\u00f3n del dashboard.';
  }
}
