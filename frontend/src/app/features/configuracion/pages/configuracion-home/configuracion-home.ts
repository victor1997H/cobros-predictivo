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
import { PagoService } from '../../../../core/services/pago.service';
import {
  CanalNotificacion,
  GestionCobranzaRegistro,
  GestionesCobranzaResponse,
  ResultadoNotificacion,
} from '../../../cobros/models/gestion-cobranza.model';
import {
  CuotaPendientePago,
  CuotasPendientesPagoResponse,
} from '../../../cuotas/models/cuota.model';
import { PagoDetalle, PagosResponse } from '../../../pagos/models/pago.model';

type NivelSeguimiento = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
type FiltroSeguimiento = 'TODOS' | NivelSeguimiento;
type SeccionDetalleCaso = 'resumen' | 'deuda' | 'gestiones' | 'pagos' | 'contacto';

interface CasoSeguimiento {
  cuotaId: number;
  prestamoId: number;
  clienteId: number;
  socio: string;
  identificacion: string;
  email: string;
  telefono: string;
  numeroCuota: number;
  montoCuota: number;
  montoCuotaTexto: string;
  totalPagadoCuotaTexto: string;
  estadoCuota: string;
  saldoPendiente: number;
  saldoPendienteTexto: string;
  saldoPendientePrestamo: number;
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
  categoriaReferenciaTexto: string;
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
  private readonly pagoService = inject(PagoService);
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
  readonly detalleSecciones: ReadonlyArray<{
    label: string;
    value: SeccionDetalleCaso;
  }> = [
    { label: 'Resumen', value: 'resumen' },
    { label: 'Deuda', value: 'deuda' },
    { label: 'Gestiones', value: 'gestiones' },
    { label: 'Pagos', value: 'pagos' },
    { label: 'Contacto', value: 'contacto' },
  ];
  readonly cuotasPendientes = signal<CuotaPendientePago[]>([]);
  readonly gestiones = signal<GestionCobranzaRegistro[]>([]);
  readonly pagos = signal<PagoDetalle[]>([]);
  readonly filtroActivo = signal<FiltroSeguimiento>('TODOS');
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly highlightedCuotaId = signal<number | null>(null);
  readonly caseRouteMessage = signal('');
  readonly detalleCaso = signal<CasoSeguimiento | null>(null);
  readonly detalleSeccionActiva = signal<SeccionDetalleCaso>('resumen');
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
  readonly gestionesDetalleCaso = computed(() => {
    const caso = this.detalleCaso();

    if (!caso) {
      return [];
    }

    return this.gestiones()
      .filter((gestion) => gestion.cuotaId === caso.cuotaId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  });
  readonly pagosDetalleCaso = computed(() => {
    const caso = this.detalleCaso();

    if (!caso) {
      return [];
    }

    return this.pagos()
      .filter(
        (pago) =>
          pago.cuota.id === caso.cuotaId ||
          pago.prestamo.id === caso.prestamoId,
      )
      .sort(
        (a, b) =>
          new Date(b.pago.fechaPago).getTime() -
          new Date(a.pago.fechaPago).getTime(),
      );
  });
  readonly ultimaGestionDetalleCaso = computed(
    () => this.gestionesDetalleCaso()[0] ?? null,
  );
  readonly prestamoDetalleCaso = computed(
    () => this.pagosDetalleCaso()[0]?.prestamo ?? null,
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
      pagos: this.pagoService.findAll().pipe(
        catchError(() =>
          of({
            success: false,
            message: '',
            pagos: [],
          } satisfies PagosResponse),
        ),
      ),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe(({ cuotas, gestiones, pagos }) => {
        this.cuotasPendientes.set(cuotas.cuotas);
        this.gestiones.set(gestiones.gestiones);
        this.pagos.set(pagos.pagos);
        this.focusCaseFromRoute();
      });
  }

  setFiltro(filtro: FiltroSeguimiento): void {
    this.filtroActivo.set(filtro);
  }

  abrirDetalleCaso(caso: CasoSeguimiento): void {
    this.detalleCaso.set(caso);
    this.detalleSeccionActiva.set('resumen');
  }

  cerrarDetalleCaso(): void {
    this.detalleCaso.set(null);
    this.detalleSeccionActiva.set('resumen');
  }

  setDetalleSeccion(seccion: SeccionDetalleCaso): void {
    this.detalleSeccionActiva.set(seccion);
  }

  estadoCaso(caso: CasoSeguimiento): string {
    if (caso.requiereOperador) {
      return 'Requiere atenci\u00f3n';
    }

    return caso.diasMora > 0 ? 'Cuota vencida' : 'Seguimiento preventivo';
  }

  motivoClasificacion(caso: CasoSeguimiento): string {
    const ultimaGestion = this.ultimaGestionDetalleCaso();

    if (ultimaGestion?.categoriaReferencia) {
      return `${this.formatCategoriaReferencia(
        ultimaGestion.categoriaReferencia,
      )} registrada con ${this.formatDiasMora(
        ultimaGestion.diasAtraso,
      )}. Nivel actual: ${this.formatRiesgo(
        ultimaGestion.nivelRiesgo as NivelSeguimiento,
      )}.`;
    }

    if (caso.diasMora > 0) {
      return `Cuota vencida con ${caso.diasMoraTexto} y saldo pendiente de ${caso.saldoPendienteTexto}.`;
    }

    return `Cuota pendiente con saldo de ${caso.saldoPendienteTexto} y vencimiento ${caso.fechaVencimientoTexto}.`;
  }

  resultadosGestion(gestion: GestionCobranzaRegistro): ResultadoNotificacion[] {
    return gestion.resultadoEnvio ?? [];
  }

  estadoEnvioTexto(gestion: GestionCobranzaRegistro): string {
    const estados: Record<string, string> = {
      ENVIADO: 'Enviado',
      PARCIAL: 'Parcial',
      ERROR: 'Con error',
      NO_CONFIGURADO: 'No configurado',
    };

    return estados[gestion.estadoEnvio] ?? gestion.estadoEnvio;
  }

  metodoPagoTexto(metodo: string): string {
    const metodos: Record<string, string> = {
      EFECTIVO: 'Efectivo',
      TRANSFERENCIA: 'Transferencia',
      DEPOSITO: 'Dep\u00f3sito',
      TARJETA: 'Tarjeta',
    };

    return metodos[metodo] ?? metodo;
  }

  riesgoClass(nivelRiesgo: NivelSeguimiento): string {
    return nivelRiesgo.toLowerCase();
  }

  cuotasVencidasPrestamo(caso: CasoSeguimiento): number {
    return this.casos().filter(
      (item) => item.prestamoId === caso.prestamoId && item.diasMora > 0,
    ).length;
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
      prestamoId: cuota.prestamoId,
      clienteId: cuota.cliente.id,
      socio: `${cuota.cliente.nombres} ${cuota.cliente.apellidos}`.trim(),
      identificacion: cuota.cliente.identificacion,
      email: cuota.cliente.email,
      telefono: cuota.cliente.telefono,
      numeroCuota: cuota.numeroCuota,
      montoCuota: cuota.montoCuota,
      montoCuotaTexto: this.formatMoney(cuota.montoCuota),
      totalPagadoCuotaTexto: this.formatMoney(cuota.totalPagadoCuota),
      estadoCuota: cuota.estado,
      saldoPendiente: cuota.saldoPendiente,
      saldoPendienteTexto: this.formatMoney(cuota.saldoPendiente),
      saldoPendientePrestamo: cuota.saldoPendientePrestamo,
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
      accionRuta: '/cobros',
      fechaVencimiento: cuota.fechaVencimiento,
      categoriaReferenciaTexto: ultimaGestion?.categoriaReferencia
        ? this.formatCategoriaReferencia(ultimaGestion.categoriaReferencia)
        : 'Sin categor\u00eda registrada',
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

  formatCanales(canales: CanalNotificacion[] | null): string {
    if (!canales?.length) {
      return 'Sin aviso registrado';
    }

    const canalesUnicos = [...new Set(canales)];

    return canalesUnicos
      .map((canal) => (canal === 'CORREO' ? 'Correo' : 'WhatsApp'))
      .join(' + ');
  }

  formatDate(value: string): string {
    return this.dateFormatter.format(this.toLocalDate(value));
  }

  formatDateTime(value: string): string {
    return this.dateTimeFormatter.format(new Date(value));
  }

  private formatCategoriaReferencia(categoria: string): string {
    return categoria === 'PREVENTIVO'
      ? 'Preventivo'
      : `Categor\u00eda ${categoria}`;
  }

  formatMoney(value: number): string {
    return this.currencyFormatter.format(value);
  }

  private toLocalDate(value: string): Date {
    const [year, month, day] = value
      .split('T')[0]
      .split('-')
      .map((part) => Number(part));

    return new Date(year, month - 1, day);
  }
}
