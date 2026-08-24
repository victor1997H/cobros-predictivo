import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';

import { CobroService } from '../../../../core/services/cobro.service';
import { CobroGestion, NivelRiesgo } from '../../models/cobro.model';

type FiltroRiesgo = 'TODOS' | NivelRiesgo;

@Component({
  selector: 'app-cobros-list',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatTableModule],
  templateUrl: './cobros-list.html',
  styleUrl: './cobros-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CobrosList implements OnInit {
  private readonly cobroService = inject(CobroService);

  readonly displayedColumns = [
    'cliente',
    'telefono',
    'cuota',
    'fechaVencimiento',
    'saldoPendiente',
    'diasAtraso',
    'nivelRiesgo',
    'accion',
    'tipoGestion',
  ];

  readonly filtros: Array<{ label: string; value: FiltroRiesgo }> = [
    { label: 'Todos', value: 'TODOS' },
    { label: 'Bajo', value: 'BAJO' },
    { label: 'Medio', value: 'MEDIO' },
    { label: 'Alto', value: 'ALTO' },
    { label: 'Cr\u00edtico', value: 'CRITICO' },
  ];

  readonly cuotas = signal<CobroGestion[]>([]);
  readonly filtroSeleccionado = signal<FiltroRiesgo>('TODOS');
  readonly fechaReferencia = signal('');
  readonly fechaManana = signal('');
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly cuotasFiltradas = computed(() => {
    const filtro = this.filtroSeleccionado();

    if (filtro === 'TODOS') {
      return this.cuotas();
    }

    return this.cuotas().filter((item) => item.nivelRiesgo === filtro);
  });

  readonly totalGestion = computed(() => this.cuotas().length);
  readonly vencenManana = computed(
    () => this.cuotas().filter((item) => item.tipoGestion === 'VENCE_MANANA').length,
  );
  readonly cuotasVencidas = computed(
    () => this.cuotas().filter((item) => item.tipoGestion === 'VENCIDA').length,
  );
  readonly saldoPendienteTotal = computed(() =>
    this.cuotas().reduce((total, item) => total + item.cuota.saldoPendiente, 0),
  );

  ngOnInit(): void {
    this.loadCobros();
  }

  loadCobros(): void {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.cobroService
      .findGestionCobranza()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.cuotas.set(response.cuotas);
          this.fechaReferencia.set(response.fechaReferencia);
          this.fechaManana.set(response.fechaManana);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  setFiltro(filtro: FiltroRiesgo): void {
    this.filtroSeleccionado.set(filtro);
  }

  nombreCliente(item: CobroGestion): string {
    return `${item.cliente.nombres} ${item.cliente.apellidos}`;
  }

  tipoGestionLabel(item: CobroGestion): string {
    return item.tipoGestion === 'VENCE_MANANA' ? 'Vence ma\u00f1ana' : 'Vencida';
  }

  categoriaReferenciaLabel(item: CobroGestion): string {
    if (!item.categoriaReferencia) {
      return 'Sin categoria';
    }

    return item.categoriaReferencia === 'PREVENTIVO'
      ? 'Preventivo'
      : `Categoria ${item.categoriaReferencia}`;
  }

  accionSugerida(item: CobroGestion): string {
    const acciones: Record<NivelRiesgo, string> = {
      BAJO: 'Aviso preventivo',
      MEDIO: 'Recordatorio de mora',
      ALTO: 'Contacto con asesor',
      CRITICO: 'Atencion urgente',
    };

    return acciones[item.nivelRiesgo];
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
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

    return 'No se pudo cargar la gestion de cobros.';
  }
}
