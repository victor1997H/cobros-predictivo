import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { CuotaService } from '../../../../core/services/cuota.service';
import { GestionCobranzaService } from '../../../../core/services/gestion-cobranza.service';
import {
  CanalNotificacion,
  GestionCobranzaRegistro,
  GestionesCobranzaResponse,
} from '../../../cobros/models/gestion-cobranza.model';
import {
  CuotaPendientePago,
  CuotasPendientesPagoResponse,
} from '../../../cuotas/models/cuota.model';

type NivelSeguimiento = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
type FiltroSeguimiento = 'TODOS' | NivelSeguimiento;

interface CasoSeguimiento {
  cuotaId: number;
  socio: string;
  numeroCuota: number;
  saldoPendienteTexto: string;
  saldoPrestamoTexto: string;
  fechaVencimientoTexto: string;
  diasMora: number;
  diasMoraTexto: string;
  nivelRiesgo: NivelSeguimiento;
  riesgoTexto: string;
  ultimaGestionTexto: string;
  canalTexto: string;
  requiereOperador: boolean;
  accionRuta: string;
  fechaVencimiento: string;
}

interface GestionReciente {
  socio: string;
  accion: string;
  riesgoTexto: string;
  canalTexto: string;
  fechaTexto: string;
}

@Component({
  selector: 'app-configuracion-home',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatTableModule, RouterLink],
  templateUrl: './configuracion-home.html',
  styleUrl: './configuracion-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguracionHome implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly cuotaService = inject(CuotaService);
  private readonly gestionCobranzaService = inject(GestionCobranzaService);
  private highlightTimeout?: ReturnType<typeof setTimeout>;
  private readonly currencyFormatter = new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  });
  private readonly dateFormatter = new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  private readonly prioridadRiesgo: Record<NivelSeguimiento, number> = {
    CRITICO: 4,
    ALTO: 3,
    MEDIO: 2,
    BAJO: 1,
  };

  readonly displayedColumns = [
    'socio',
    'saldo',
    'vencimiento',
    'mora',
    'riesgo',
    'gestion',
    'canal',
    'accion',
  ];
  readonly filtros: ReadonlyArray<{ label: string; value: FiltroSeguimiento }> = [
    { label: 'Todos', value: 'TODOS' },
    { label: 'Cr\u00edtico', value: 'CRITICO' },
    { label: 'Alto', value: 'ALTO' },
    { label: 'Medio', value: 'MEDIO' },
    { label: 'Bajo', value: 'BAJO' },
  ];
  readonly cuotasPendientes = signal<CuotaPendientePago[]>([]);
  readonly gestiones = signal<GestionCobranzaRegistro[]>([]);
  readonly filtroActivo = signal<FiltroSeguimiento>('TODOS');
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly highlightedCuotaId = signal<number | null>(null);
  readonly caseRouteMessage = signal('');
  private readonly pendingCuotaId = signal<number | null>(null);

  readonly ultimasGestionesPorCuota = computed(() => {
    const gestionesOrdenadas = [...this.gestiones()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const porCuota = new Map<number, GestionCobranzaRegistro>();

    for (const gestion of gestionesOrdenadas) {
      if (!porCuota.has(gestion.cuotaId)) {
        porCuota.set(gestion.cuotaId, gestion);
      }
    }

    return porCuota;
  });

  readonly casos = computed(() =>
    this.cuotasPendientes()
      .map((cuota) => this.buildCasoSeguimiento(cuota))
      .sort((a, b) => this.compareCasos(a, b)),
  );

  readonly casosFiltrados = computed(() => {
    const filtro = this.filtroActivo();

    if (filtro === 'TODOS') {
      return this.casos();
    }

    return this.casos().filter((caso) => caso.nivelRiesgo === filtro);
  });

  readonly casosCriticos = computed(
    () => this.casos().filter((caso) => caso.nivelRiesgo === 'CRITICO').length,
  );
  readonly casosAlto = computed(
    () => this.casos().filter((caso) => caso.nivelRiesgo === 'ALTO').length,
  );
  readonly cuotasVencidas = computed(
    () => this.casos().filter((caso) => caso.diasMora > 0).length,
  );
  readonly mostrarAtencionOperador = computed(() =>
    this.gestiones().some((gestion) => Boolean(gestion.alertaInterna)),
  );
  readonly atencionOperador = computed(
    () => this.casos().filter((caso) => caso.requiereOperador).length,
  );
  readonly gestionesRecientes = computed<GestionReciente[]>(() =>
    [...this.gestiones()]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5)
      .map((gestion) => ({
        socio: gestion.clienteNombre,
        accion: gestion.accion,
        riesgoTexto: this.formatRiesgo(gestion.nivelRiesgo as NivelSeguimiento),
        canalTexto: this.formatCanales(gestion.canalesSolicitados),
        fechaTexto: this.formatDateTime(gestion.createdAt),
      })),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.clearHighlightTimer());
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const cuotaId = Number(params.get('cuotaId'));

        this.pendingCuotaId.set(
          Number.isInteger(cuotaId) && cuotaId > 0 ? cuotaId : null,
        );
        this.caseRouteMessage.set('');

        if (this.cuotasPendientes().length > 0) {
          this.focusCaseFromRoute();
        }
      });

    this.loadCentroSeguimiento();
  }

  loadCentroSeguimiento(): void {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    forkJoin({
      cuotas: this.cuotaService.findPendientesParaPago().pipe(
        catchError(() => {
          this.errorMessage.set(
            'No se pudieron cargar los casos pendientes. Intenta nuevamente.',
          );
          return of({
            success: false,
            message: '',
            cuotas: [],
          } satisfies CuotasPendientesPagoResponse);
        }),
      ),
      gestiones: this.gestionCobranzaService.findAll().pipe(
        catchError(() =>
          of({
            success: false,
            message: '',
            gestiones: [],
          } satisfies GestionesCobranzaResponse),
        ),
      ),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe(({ cuotas, gestiones }) => {
        this.cuotasPendientes.set(cuotas.cuotas);
        this.gestiones.set(gestiones.gestiones);
        this.focusCaseFromRoute();
      });
  }

  setFiltro(filtro: FiltroSeguimiento): void {
    this.filtroActivo.set(filtro);
  }

  private focusCaseFromRoute(): void {
    const cuotaId = this.pendingCuotaId();

    if (!cuotaId) {
      return;
    }

    const caso = this.casos().find(
      (casoSeguimiento) => casoSeguimiento.cuotaId === cuotaId,
    );

    if (!caso) {
      this.highlightedCuotaId.set(null);
      this.caseRouteMessage.set('Este caso ya no requiere atenci\u00f3n.');
      return;
    }

    if (!this.casosFiltrados().some((casoFiltrado) => casoFiltrado.cuotaId === cuotaId)) {
      this.filtroActivo.set(caso.nivelRiesgo);
    }

    this.caseRouteMessage.set('Caso seleccionado para revisi\u00f3n.');
    this.highlightedCuotaId.set(cuotaId);

    setTimeout(() => this.scrollToCase(cuotaId));
    this.clearHighlightTimer();
    this.highlightTimeout = setTimeout(() => {
      this.highlightedCuotaId.set(null);
    }, 3500);
  }

  private scrollToCase(cuotaId: number): void {
    const element = this.elementRef.nativeElement.querySelector(
      `[data-cuota-id="${cuotaId}"]`,
    ) as HTMLElement | null;

    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private clearHighlightTimer(): void {
    if (!this.highlightTimeout) {
      return;
    }

    clearTimeout(this.highlightTimeout);
    this.highlightTimeout = undefined;
  }

  private buildCasoSeguimiento(cuota: CuotaPendientePago): CasoSeguimiento {
    const ultimaGestion = this.ultimasGestionesPorCuota().get(cuota.cuotaId);
    const diasMora = this.calculateDiasMora(cuota.fechaVencimiento);
    const nivelRiesgo = this.resolveNivelRiesgo(diasMora);

    return {
      cuotaId: cuota.cuotaId,
      socio: `${cuota.cliente.nombres} ${cuota.cliente.apellidos}`.trim(),
      numeroCuota: cuota.numeroCuota,
      saldoPendienteTexto: this.formatMoney(cuota.saldoPendiente),
      saldoPrestamoTexto: this.formatMoney(cuota.saldoPendientePrestamo),
      fechaVencimientoTexto: this.formatDate(cuota.fechaVencimiento),
      diasMora,
      diasMoraTexto: this.formatDiasMora(diasMora),
      nivelRiesgo,
      riesgoTexto: this.formatRiesgo(nivelRiesgo),
      ultimaGestionTexto: ultimaGestion
        ? `${this.formatDateTime(ultimaGestion.createdAt)} - ${ultimaGestion.accion}`
        : 'Sin gesti\u00f3n registrada',
      canalTexto: ultimaGestion
        ? this.formatCanales(ultimaGestion.canalesSolicitados)
        : 'Sin aviso registrado',
      requiereOperador: Boolean(
        ultimaGestion?.alertaInterna?.requiereIntervencionHumana ||
          ultimaGestion?.alertaInterna,
      ),
      accionRuta: diasMora > 0 ? '/cobros' : '/pagos',
      fechaVencimiento: cuota.fechaVencimiento,
    };
  }

  private compareCasos(a: CasoSeguimiento, b: CasoSeguimiento): number {
    const prioridad =
      this.prioridadRiesgo[b.nivelRiesgo] - this.prioridadRiesgo[a.nivelRiesgo];

    if (prioridad !== 0) {
      return prioridad;
    }

    if (b.diasMora !== a.diasMora) {
      return b.diasMora - a.diasMora;
    }

    return (
      this.toLocalDate(a.fechaVencimiento).getTime() -
      this.toLocalDate(b.fechaVencimiento).getTime()
    );
  }

  private calculateDiasMora(fechaVencimiento: string): number {
    const hoy = this.toLocalDate(new Date().toISOString().slice(0, 10));
    const vencimiento = this.toLocalDate(fechaVencimiento);
    const diff = hoy.getTime() - vencimiento.getTime();

    return Math.max(0, Math.floor(diff / 86_400_000));
  }

  private resolveNivelRiesgo(diasMora: number): NivelSeguimiento {
    if (diasMora >= 91) {
      return 'CRITICO';
    }

    if (diasMora >= 31) {
      return 'ALTO';
    }

    if (diasMora >= 1) {
      return 'MEDIO';
    }

    return 'BAJO';
  }

  private formatRiesgo(nivelRiesgo: NivelSeguimiento): string {
    if (nivelRiesgo === 'CRITICO') {
      return 'Cr\u00edtico';
    }

    return nivelRiesgo.charAt(0) + nivelRiesgo.slice(1).toLowerCase();
  }

  private formatDiasMora(diasMora: number): string {
    if (diasMora === 0) {
      return 'Sin mora';
    }

    return diasMora === 1 ? '1 d\u00eda' : `${diasMora} d\u00edas`;
  }

  private formatCanales(canales: CanalNotificacion[] | null): string {
    if (!canales?.length) {
      return 'Sin aviso registrado';
    }

    const canalesUnicos = [...new Set(canales)];

    return canalesUnicos
      .map((canal) => (canal === 'CORREO' ? 'Correo' : 'WhatsApp'))
      .join(' + ');
  }

  private formatMoney(value: number): string {
    return this.currencyFormatter.format(value);
  }

  private formatDate(value: string): string {
    return this.dateFormatter.format(this.toLocalDate(value));
  }

  private formatDateTime(value: string): string {
    return this.dateTimeFormatter.format(new Date(value));
  }

  private toLocalDate(value: string): Date {
    const [year, month, day] = value
      .split('T')[0]
      .split('-')
      .map((part) => Number(part));

    return new Date(year, month - 1, day);
  }
}
