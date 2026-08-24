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
import { PagoService } from '../../../../core/services/pago.service';
import { CuotaPendientePago } from '../../../cuotas/models/cuota.model';
import { PagoDetalle, PagoMetodo, PagoPayload } from '../../models/pago.model';

@Component({
  selector: 'app-pagos-list',
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
  templateUrl: './pagos-list.html',
  styleUrl: './pagos-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagosList implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly pagoService = inject(PagoService);
  private readonly cuotaService = inject(CuotaService);

  readonly displayedColumns = [
    'fechaPago',
    'cliente',
    'cuota',
    'monto',
    'metodoPago',
    'saldoPendiente',
    'estado',
  ];

  readonly metodosPago: Array<{ label: string; value: PagoMetodo }> = [
    { label: 'Efectivo', value: 'EFECTIVO' },
    { label: 'Transferencia', value: 'TRANSFERENCIA' },
    { label: 'Dep\u00f3sito', value: 'DEPOSITO' },
    { label: 'Tarjeta', value: 'TARJETA' },
  ];

  readonly form = this.formBuilder.group({
    cuotaId: [null as number | null, [Validators.required]],
    monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
    metodoPago: ['EFECTIVO' as PagoMetodo, [Validators.required]],
    referencia: [''],
    observacion: [''],
  });

  readonly pagos = signal<PagoDetalle[]>([]);
  readonly cuotasDisponibles = signal<CuotaPendientePago[]>([]);
  readonly selectedCuotaId = signal<number | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly feedbackMessage = signal('');
  readonly errorMessage = signal('');

  readonly totalPagos = computed(() => this.pagos().length);
  readonly totalRecaudado = computed(() =>
    this.pagos().reduce((total, item) => total + item.pago.monto, 0),
  );
  readonly cuotasParaPagar = computed(() => this.cuotasDisponibles().length);
  readonly cuotaSeleccionada = computed(() =>
    this.cuotasDisponibles().find((item) => item.cuotaId === this.selectedCuotaId()),
  );
  saldoDespuesDelPago(): number {
    const cuota = this.cuotaSeleccionada();
    const monto = Number(this.form.controls.monto.value ?? 0);

    if (!cuota) {
      return 0;
    }

    return Math.max(cuota.saldoPendiente - monto, 0);
  }

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
      pagos: this.pagoService.findAll(),
      pendientes: this.cuotaService.findPendientesParaPago(),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ pagos, pendientes }) => {
          this.pagos.set(pagos.pagos);
          this.cuotasDisponibles.set(pendientes.cuotas);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  onCuotaChange(cuotaId: number | null): void {
    this.selectedCuotaId.set(cuotaId);
    const cuota = this.cuotaSeleccionada();

    if (cuota) {
      this.form.controls.monto.setValue(cuota.saldoPendiente);
    }
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

    if (value.cuotaId === null || value.monto === null) {
      return;
    }

    const cuota = this.cuotaSeleccionada();
    const monto = Number(value.monto);

    if (cuota && monto > cuota.saldoPendiente) {
      this.errorMessage.set('El monto pagado no puede superar el saldo pendiente de la cuota.');
      return;
    }

    const payload: PagoPayload = {
      cuotaId: Number(value.cuotaId),
      monto,
      metodoPago: value.metodoPago ?? 'EFECTIVO',
      referencia: value.referencia?.trim() || null,
      observacion: value.observacion?.trim() || null,
    };

    this.isSaving.set(true);
    this.clearMessages();

    this.pagoService
      .create(payload)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: (response) => {
          this.feedbackMessage.set(response.message);
          this.clearForm();
          this.loadData(false);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  nombreCliente(item: PagoDetalle | CuotaPendientePago): string {
    return `${item.cliente.nombres} ${item.cliente.apellidos}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  clearForm(): void {
    this.form.reset({
      cuotaId: null,
      monto: null,
      metodoPago: 'EFECTIVO',
      referencia: '',
      observacion: '',
    });
    this.selectedCuotaId.set(null);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private clearMessages(): void {
    this.feedbackMessage.set('');
    this.errorMessage.set('');
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

    return 'No se pudo completar la operaci\u00f3n.';
  }
}
