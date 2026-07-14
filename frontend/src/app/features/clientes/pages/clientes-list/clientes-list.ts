import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';

import { ClienteService } from '../../../../core/services/cliente.service';
import { ClienteForm } from '../../components/cliente-form/cliente-form';
import { Cliente, ClientePayload } from '../../models/cliente.model';

@Component({
  selector: 'app-clientes-list',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatTableModule, ClienteForm],
  templateUrl: './clientes-list.html',
  styleUrl: './clientes-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientesList implements OnInit {
  private readonly clienteService = inject(ClienteService);

  readonly displayedColumns = [
    'id',
    'nombreCompleto',
    'identificacion',
    'email',
    'telefono',
    'estado',
    'acciones',
  ];

  readonly clientes = signal<Cliente[]>([]);
  readonly selectedCliente = signal<Cliente | null>(null);
  readonly showForm = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly feedbackMessage = signal('');
  readonly errorMessage = signal('');

  ngOnInit(): void {
    this.loadClientes();
  }

  loadClientes(showLoading = true): void {
    if (showLoading) {
      this.isLoading.set(true);
    }

    this.errorMessage.set('');

    this.clienteService
      .findAll()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.clientes.set(response.clientes);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  newCliente(): void {
    this.selectedCliente.set(null);
    this.showForm.set(true);
    this.clearMessages();
  }

  editCliente(cliente: Cliente): void {
    this.selectedCliente.set(cliente);
    this.showForm.set(true);
    this.clearMessages();
  }

  saveCliente(payload: ClientePayload): void {
    if (this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.clearMessages();

    const cliente = this.selectedCliente();
    const request = cliente
      ? this.clienteService.update(cliente.id, payload)
      : this.clienteService.create(payload);

    request.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: (response) => {
        this.feedbackMessage.set(response.message);
        this.syncClienteInList(response.cliente);
        this.showForm.set(false);
        this.selectedCliente.set(null);
        this.loadClientes(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  deleteCliente(cliente: Cliente): void {
    const confirmed = confirm(
      `Eliminar al cliente ${cliente.nombres} ${cliente.apellidos}?`,
    );

    if (!confirmed) {
      return;
    }

    this.clearMessages();

    this.clienteService.delete(cliente.id).subscribe({
      next: (response) => {
        this.feedbackMessage.set(response.message);
        this.clientes.update((clientes) =>
          clientes.filter((item) => item.id !== cliente.id),
        );
        this.loadClientes(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.resolveErrorMessage(error));
      },
    });
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.selectedCliente.set(null);
    this.clearMessages();
  }

  fullName(cliente: Cliente): string {
    return `${cliente.nombres} ${cliente.apellidos}`;
  }

  private clearMessages(): void {
    this.feedbackMessage.set('');
    this.errorMessage.set('');
  }

  private syncClienteInList(cliente: Cliente): void {
    this.clientes.update((clientes) => {
      const exists = clientes.some((item) => item.id === cliente.id);

      if (!exists) {
        return [cliente, ...clientes];
      }

      return clientes.map((item) => (item.id === cliente.id ? cliente : item));
    });
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
