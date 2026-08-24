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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { finalize, forkJoin } from 'rxjs';

import { ClienteService } from '../../../../core/services/cliente.service';
import { PrestamoService } from '../../../../core/services/prestamo.service';
import { Cliente } from '../../../clientes/models/cliente.model';
import { Prestamo, PrestamoPayload } from '../../models/prestamo.model';

@Component({
  selector: 'app-prestamos-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
  ],
  templateUrl: './prestamos-list.html',
  styleUrl: './prestamos-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrestamosList implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly clienteService = inject(ClienteService);
  private readonly prestamoService = inject(PrestamoService);
  private readonly financialControlNames = [
    'clienteId',
    'monto',
    'fechaInicio',
    'numeroCuotas',
  ] as const;

  readonly displayedColumns = [
    'cliente',
    'monto',
    'fechaInicio',
    'numeroCuotas',
    'estado',
    'acciones',
  ];

  readonly estados = ['ACTIVO', 'FINALIZADO', 'REFINANCIADO', 'PRUEBA'] as const;

  readonly form = this.formBuilder.group({
    clienteId: [null as number | null, [Validators.required]],
    monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
    fechaInicio: [this.today(), [Validators.required]],
    numeroCuotas: [1, [Validators.required, Validators.min(1)]],
    estado: ['ACTIVO', [Validators.required]],
    generarCuotas: [true],
    fechaPrimerVencimiento: [this.addDays(this.today(), 30)],
  });

  readonly clientes = signal<Cliente[]>([]);
  readonly prestamos = signal<Prestamo[]>([]);
  readonly selectedPrestamo = signal<Prestamo | null>(null);
  readonly showForm = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly feedbackMessage = signal('');
  readonly errorMessage = signal('');
  readonly financialEditionLocked = computed(() => {
    const prestamo = this.selectedPrestamo();

    return Boolean(
      prestamo && prestamo.puedeEditarCondicionesFinancieras === false,
    );
  });
  readonly financialEditionLockMessage = computed(
    () => this.selectedPrestamo()?.motivoBloqueoEdicion ?? '',
  );

  readonly totalPrestado = computed(() =>
    this.prestamos().reduce(
      (total, prestamo) => total + Number(prestamo.monto),
      0,
    ),
  );
  readonly prestamosActivos = computed(
    () =>
      this.prestamos().filter((prestamo) => prestamo.estado === 'ACTIVO')
        .length,
  );
  readonly cuotasProgramadas = computed(() =>
    this.prestamos().reduce(
      (total, prestamo) => total + prestamo.numeroCuotas,
      0,
    ),
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
      clientes: this.clienteService.findAll(),
      prestamos: this.prestamoService.findAll(),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ clientes, prestamos }) => {
          this.clientes.set(clientes.clientes);
          this.prestamos.set(prestamos.prestamos);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  newPrestamo(): void {
    this.selectedPrestamo.set(null);
    this.showForm.set(true);
    this.clearMessages();
    this.form.reset({
      clienteId: null,
      monto: null,
      fechaInicio: this.today(),
      numeroCuotas: 1,
      estado: 'ACTIVO',
      generarCuotas: true,
      fechaPrimerVencimiento: this.addDays(this.today(), 30),
    });
    this.syncFormLockState();
  }

  editPrestamo(prestamo: Prestamo): void {
    this.selectedPrestamo.set(prestamo);
    this.showForm.set(true);
    this.clearMessages();
    this.form.reset({
      clienteId: prestamo.clienteId,
      monto: Number(prestamo.monto),
      fechaInicio: prestamo.fechaInicio,
      numeroCuotas: prestamo.numeroCuotas,
      estado: prestamo.estado,
      generarCuotas: false,
      fechaPrimerVencimiento: this.addDays(prestamo.fechaInicio, 30),
    });
    this.syncFormLockState();
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.selectedPrestamo.set(null);
    this.clearMessages();
    this.syncFormLockState();
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

    if (value.clienteId === null || value.monto === null) {
      return;
    }

    const payload: PrestamoPayload = {
      clienteId: Number(value.clienteId),
      monto: Number(value.monto),
      fechaInicio: value.fechaInicio ?? this.today(),
      numeroCuotas: Number(value.numeroCuotas ?? 1),
      estado: value.estado ?? 'ACTIVO',
      generarCuotas: Boolean(value.generarCuotas),
      fechaPrimerVencimiento: value.fechaPrimerVencimiento || undefined,
    };
    const prestamo = this.selectedPrestamo();
    const request = prestamo
      ? this.prestamoService.update(prestamo.id, payload)
      : this.prestamoService.create(payload);

    this.isSaving.set(true);
    this.clearMessages();

    request.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: (response) => {
        const generadas = response.cuotasGeneradas?.length ?? 0;
        const detalle =
          generadas > 0 ? ` (${generadas} cuotas generadas)` : '';

        this.feedbackMessage.set(`${response.message}${detalle}`);
        this.showForm.set(false);
        this.selectedPrestamo.set(null);
        this.loadData(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  deletePrestamo(prestamo: Prestamo): void {
    const confirmed = confirm(
      `Eliminar el prestamo #${prestamo.id} de ${this.nombreCliente(prestamo)}?`,
    );

    if (!confirmed) {
      return;
    }

    this.clearMessages();
    this.prestamoService.delete(prestamo.id).subscribe({
      next: (response) => {
        this.feedbackMessage.set(response.message);
        this.loadData(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  nombreCliente(prestamo: Prestamo): string {
    return `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`;
  }

  clienteLabel(cliente: Cliente): string {
    return `${cliente.nombres} ${cliente.apellidos} - ${cliente.identificacion}`;
  }

  formatCurrency(value: number | string): string {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(value));
  }

  private clearMessages(): void {
    this.feedbackMessage.set('');
    this.errorMessage.set('');
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private addDays(date: string, days: number): string {
    const parsedDate = new Date(`${date}T00:00:00.000Z`);

    parsedDate.setUTCDate(parsedDate.getUTCDate() + days);

    return parsedDate.toISOString().slice(0, 10);
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

  private syncFormLockState(): void {
    const shouldLockFinancialFields = this.financialEditionLocked();

    for (const controlName of this.financialControlNames) {
      const control = this.form.controls[controlName];

      if (shouldLockFinancialFields) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    }

    if (this.selectedPrestamo()) {
      this.form.controls.generarCuotas.disable({ emitEvent: false });
      this.form.controls.fechaPrimerVencimiento.disable({ emitEvent: false });
    } else {
      this.form.controls.generarCuotas.enable({ emitEvent: false });
      this.form.controls.fechaPrimerVencimiento.enable({ emitEvent: false });
    }
  }
}
