import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { finalize, forkJoin } from 'rxjs';

import { CobroService } from '../../../../core/services/cobro.service';
import { PagoService } from '../../../../core/services/pago.service';
import {
  ClienteGestion,
  CobroGestion,
  NivelRiesgo,
} from '../../../cobros/models/cobro.model';
import { PagoDetalle } from '../../../pagos/models/pago.model';

interface CasoPrioritario {
  id: number;
  cliente: string;
  situacion: string;
  prioridad: string;
  nivelRiesgo: NivelRiesgo;
  diasAtraso: number;
}

interface ResumenRiesgoItem {
  nivel: NivelRiesgo;
  etiqueta: string;
  cantidad: number;
  porcentaje: number;
}

const ORDEN_RIESGO: Record<NivelRiesgo, number> = {
  CRITICO: 0,
  ALTO: 1,
  MEDIO: 2,
  BAJO: 3,
};

const ETIQUETAS_RIESGO: Record<NivelRiesgo, string> = {
  CRITICO: 'Critico',
  ALTO: 'Alto',
  MEDIO: 'Medio',
  BAJO: 'Bajo',
};

@Component({
  selector: 'app-dashboard-home',
  imports: [],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHome implements OnInit {
  private readonly cobroService = inject(CobroService);
  private readonly pagoService = inject(PagoService);

  readonly cuotasGestion = signal<CobroGestion[]>([]);
  readonly pagos = signal<PagoDetalle[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly cuotasVencidas = computed(
    () => this.cuotasGestion().filter((item) => item.tipoGestion === 'VENCIDA').length,
  );

  readonly saldoEnGestion = computed(() =>
    this.cuotasGestion().reduce((total, item) => total + item.cuota.saldoPendiente, 0),
  );

  readonly riesgoCritico = computed(
    () => this.cuotasGestion().filter((item) => item.nivelRiesgo === 'CRITICO').length,
  );

  readonly totalRecaudado = computed(() =>
    this.pagos().reduce((total, item) => total + item.pago.monto, 0),
  );

  readonly casosPrioritarios = computed<CasoPrioritario[]>(() =>
    [...this.cuotasGestion()]
      .filter((item) => item.cuota.saldoPendiente > 0)
      .map((item) => ({
        id: item.cuota.id,
        cliente: this.fullName(item.cliente),
        situacion: this.resolveSituacion(item),
        prioridad: ETIQUETAS_RIESGO[item.nivelRiesgo],
        nivelRiesgo: item.nivelRiesgo,
        diasAtraso: item.diasAtraso,
      }))
      .sort((a, b) => {
        const riesgo = ORDEN_RIESGO[a.nivelRiesgo] - ORDEN_RIESGO[b.nivelRiesgo];

        if (riesgo !== 0) {
          return riesgo;
        }

        return b.diasAtraso - a.diasAtraso;
      }),
  );

  readonly resumenRiesgo = computed<ResumenRiesgoItem[]>(() => {
    const conteoPorCliente = this.resolveConteoRiesgoPorCliente();
    const total = Object.values(conteoPorCliente).reduce(
      (acumulado, cantidad) => acumulado + cantidad,
      0,
    );

    return (['CRITICO', 'ALTO', 'MEDIO', 'BAJO'] as NivelRiesgo[]).map((nivel) => ({
      nivel,
      etiqueta: ETIQUETAS_RIESGO[nivel],
      cantidad: conteoPorCliente[nivel],
      porcentaje: total > 0 ? Math.round((conteoPorCliente[nivel] / total) * 100) : 0,
    }));
  });

  readonly totalClientesClasificados = computed(() =>
    this.resumenRiesgo().reduce((total, item) => total + item.cantidad, 0),
  );

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    forkJoin({
      gestion: this.cobroService.findGestionCobranza(),
      pagos: this.pagoService.findAll(),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ gestion, pagos }) => {
          this.cuotasGestion.set(gestion.cuotas);
          this.pagos.set(pagos.pagos);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  riskClass(nivel: NivelRiesgo): string {
    return `risk-${nivel.toLowerCase()}`;
  }

  private resolveConteoRiesgoPorCliente(): Record<NivelRiesgo, number> {
    const riesgoPorCliente = new Map<number, NivelRiesgo>();

    for (const item of this.cuotasGestion()) {
      const riesgoActual = riesgoPorCliente.get(item.cliente.id);

      if (!riesgoActual || ORDEN_RIESGO[item.nivelRiesgo] < ORDEN_RIESGO[riesgoActual]) {
        riesgoPorCliente.set(item.cliente.id, item.nivelRiesgo);
      }
    }

    const conteo: Record<NivelRiesgo, number> = {
      CRITICO: 0,
      ALTO: 0,
      MEDIO: 0,
      BAJO: 0,
    };

    for (const nivel of riesgoPorCliente.values()) {
      conteo[nivel] += 1;
    }

    return conteo;
  }

  private fullName(cliente: ClienteGestion): string {
    return `${cliente.nombres} ${cliente.apellidos}`.trim();
  }

  private resolveSituacion(item: CobroGestion): string {
    const saldo = this.formatCurrency(item.cuota.saldoPendiente);
    const cuota = `Cuota ${item.cuota.numeroCuota}`;

    if (item.tipoGestion === 'VENCE_MANANA') {
      return `${cuota} vence pronto - saldo pendiente ${saldo}`;
    }

    if (item.diasAtraso > 0) {
      return `${cuota} vencida - ${item.diasAtraso} dias de mora - saldo pendiente ${saldo}`;
    }

    return `${cuota} pendiente - saldo pendiente ${saldo}`;
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

    return 'No se pudo cargar la informacion del dashboard.';
  }
}
