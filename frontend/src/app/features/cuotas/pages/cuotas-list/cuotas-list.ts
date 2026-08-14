import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { finalize, forkJoin } from 'rxjs';

import { CuotaService } from '../../../../core/services/cuota.service';
import { PrestamoService } from '../../../../core/services/prestamo.service';
import { Prestamo } from '../../../prestamos/models/prestamo.model';
import { Cuota, CuotaEstado, CuotaPayload } from '../../models/cuota.model';

type FiltroCuota = 'TODAS' | CuotaEstado;

@Component({
  selector: 'app-cuotas-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
  ],
  templateUrl: './cuotas-list.html',
  styleUrl: './cuotas-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuotasList implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly cuotaService = inject(CuotaService);
  private readonly prestamoService = inject(PrestamoService);

  readonly displayedColumns = [
    'cliente',
    'prestamo',
    'numeroCuota',
    'fechaVencimiento',
    'monto',
    'saldoPendiente',
    'estado',
    'riesgo',
    'acciones',
  ];

  readonly estados: CuotaEstado[] = ['PENDIENTE', 'VENCIDA', 'PAGADA'];
  readonly filtros: Array<{ label: string; value: FiltroCuota }> = [
    { label: 'Todas', value: 'TODAS' },
    { label: 'Pendientes', value: 'PENDIENTE' },
    { label: 'Vencidas', value: 'VENCIDA' },
    { label: 'Pagadas', value: 'PAGADA' },
  ];

  readonly form = this.formBuilder.group({
    prestamoId: [null as number | null, [Validators.required]],
    numeroCuota: [1, [Validators.required, Validators.min(1)]],
    fechaVencimiento: [this.today(), [Validators.required]],
    monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
    saldoPendiente: [
      null as number | null,
      [Validators.required, Validators.min(0)],
    ],
    estado: ['PENDIENTE' as CuotaEstado, [Validators.required]],
  });

  readonly prestamos = signal<Prestamo[]>([]);
  readonly cuotas = signal<Cuota[]>([]);
  readonly selectedCuota = signal<Cuota | null>(null);
  readonly filtroSeleccionado = signal<FiltroCuota>('TODAS');
  readonly showForm = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly feedbackMessage = signal('');
  readonly errorMessage = signal('');

  readonly cuotasFiltradas = computed(() => {
    const filtro = this.filtroSeleccionado();

    if (filtro === 'TODAS') {
      return this.cuotas();
    }

    return this.cuotas().filter((cuota) => cuota.estado === filtro);
  });
  readonly saldoPendienteTotal = computed(() =>
    this.cuotas().reduce(
      (total, cuota) => total + Number(cuota.saldoPendiente),
      0,
    ),
  );
  readonly cuotasGestionables = computed(
    () => this.cuotas().filter((cuota) => this.esGestionable(cuota)).length,
  );

  ngOnInit(): void {
    this.loadData();
  }

  loadData(clearMessages = true): void {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);

    if (clearMessages) {
      this.clearMessages();
    }

    forkJoin({
      prestamos: this.prestamoService.findAll(),
      cuotas: this.cuotaService.findAll(),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ prestamos, cuotas }) => {
          this.prestamos.set(prestamos.prestamos);
          this.cuotas.set(cuotas.cuotas);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  newCuota(): void {
    this.selectedCuota.set(null);
    this.showForm.set(true);
    this.clearMessages();
    this.form.reset({
      prestamoId: null,
      numeroCuota: this.siguienteNumeroCuota(),
      fechaVencimiento: this.today(),
      monto: null,
      saldoPendiente: null,
      estado: 'PENDIENTE',
    });
  }

  editCuota(cuota: Cuota): void {
    this.selectedCuota.set(cuota);
    this.showForm.set(true);
    this.clearMessages();
    this.form.reset({
      prestamoId: cuota.prestamoId,
      numeroCuota: cuota.numeroCuota,
      fechaVencimiento: cuota.fechaVencimiento,
      monto: Number(cuota.monto),
      saldoPendiente: Number(cuota.saldoPendiente),
      estado: cuota.estado,
    });
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.selectedCuota.set(null);
    this.clearMessages();
  }

  submit(): void {
    if (this.isSaving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    if (value.prestamoId === null || value.monto === null || value.saldoPendiente === null) {
      return;
    }

    const monto = Number(value.monto);
    const saldoPendiente = Number(value.saldoPendiente);

    if (saldoPendiente > monto) {
      this.errorMessage.set('El saldo pendiente no puede superar el monto de la cuota.');
      return;
    }

    const payload: CuotaPayload = {
      prestamoId: Number(value.prestamoId),
      numeroCuota: Number(value.numeroCuota ?? 1),
      fechaVencimiento: value.fechaVencimiento ?? this.today(),
      monto,
      saldoPendiente,
      estado: value.estado ?? 'PENDIENTE',
    };
    const cuota = this.selectedCuota();
    const request = cuota
      ? this.cuotaService.update(cuota.id, payload)
      : this.cuotaService.create(payload);

    this.isSaving.set(true);
    this.clearMessages();

    request.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: (response) => {
        this.feedbackMessage.set(response.message);
        this.showForm.set(false);
        this.selectedCuota.set(null);
        this.loadData(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  deleteCuota(cuota: Cuota): void {
    const confirmed = confirm(
      `Eliminar la cuota #${cuota.numeroCuota} del prestamo ${cuota.prestamoId}?`,
    );

    if (!confirmed) {
      return;
    }

    this.clearMessages();
    this.cuotaService.delete(cuota.id).subscribe({
      next: (response) => {
        this.feedbackMessage.set(response.message);
        this.loadData(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  setFiltro(filtro: FiltroCuota): void {
    this.filtroSeleccionado.set(filtro);
  }

  nombreCliente(cuota: Cuota): string {
    return `${cuota.prestamo.cliente.nombres} ${cuota.prestamo.cliente.apellidos}`;
  }

  prestamoLabel(prestamo: Prestamo): string {
    return `#${prestamo.id} - ${prestamo.cliente.nombres} ${prestamo.cliente.apellidos} - ${this.formatCurrency(prestamo.monto)}`;
  }

  diasAtraso(cuota: Cuota): number {
    const diff = this.diffDays(cuota.fechaVencimiento, this.today());

    return Math.max(diff, 0);
  }

  nivelRiesgo(cuota: Cuota): string {
    const dias = this.diasAtraso(cuota);

    if (cuota.estado === 'PAGADA') {
      return 'PAGADA';
    }

    if (dias <= 0) {
      return 'BAJO';
    }

    if (dias <= 30) {
      return 'MEDIO';
    }

    if (dias <= 90) {
      return 'ALTO';
    }

    return 'CRITICO';
  }

  esGestionable(cuota: Cuota): boolean {
    return (
      cuota.estado !== 'PAGADA' &&
      Number(cuota.saldoPendiente) > 0 &&
      this.diffDays(cuota.fechaVencimiento, this.today()) >= -1
    );
  }

  formatCurrency(value: number | string): string {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(value));
  }

  private siguienteNumeroCuota(): number {
    return this.cuotas().length + 1;
  }

  private clearMessages(): void {
    this.feedbackMessage.set('');
    this.errorMessage.set('');
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private diffDays(from: string, to: string): number {
    const fromDate = new Date(`${from}T00:00:00.000Z`).getTime();
    const toDate = new Date(`${to}T00:00:00.000Z`).getTime();

    return Math.floor((toDate - fromDate) / (24 * 60 * 60 * 1000));
  }

  private resolveErrorMessage(error: unknown): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'TimeoutError'
    ) {
      return 'La solicitud tardo demasiado. Verifica la conexion e intenta nuevamente.';
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

    return 'No se pudo completar la operacion.';
  }
}
