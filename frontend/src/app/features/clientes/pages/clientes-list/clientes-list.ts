import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { finalize, timeout } from 'rxjs';

import { ClienteService } from '../../../../core/services/cliente.service';
import { ClienteForm } from '../../components/cliente-form/cliente-form';
import { Cliente, ClientePayload } from '../../models/cliente.model';

@Component({
  selector: 'app-clientes-list',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatTableModule, ClienteForm],
  templateUrl: './clientes-list.html',
  styleUrl: './clientes-list.scss',
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

  clientes: Cliente[] = [];
  selectedCliente: Cliente | null = null;
  showForm = false;
  isLoading = false;
  isSaving = false;
  feedbackMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    this.loadClientes();
  }

  loadClientes(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.clienteService
      .findAll()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          this.clientes = response.clientes;
        },
        error: (error: unknown) => {
          this.errorMessage = this.resolveErrorMessage(error);
        },
      });
  }

  newCliente(): void {
    this.selectedCliente = null;
    this.showForm = true;
    this.clearMessages();
  }

  editCliente(cliente: Cliente): void {
    this.selectedCliente = cliente;
    this.showForm = true;
    this.clearMessages();
  }

  saveCliente(payload: ClientePayload): void {
    if (this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.clearMessages();

    const request = this.selectedCliente
      ? this.clienteService.update(this.selectedCliente.id, payload)
      : this.clienteService.create(payload);

    request
      .pipe(timeout(15000), finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (response) => {
          this.feedbackMessage = response.message;
          this.syncClienteInList(response.cliente);
          this.showForm = false;
          this.selectedCliente = null;
          this.loadClientes();
        },
        error: (error: unknown) => {
          this.errorMessage = this.resolveErrorMessage(error);
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
        this.feedbackMessage = response.message;
        this.loadClientes();
      },
      error: (error: unknown) => {
        this.errorMessage = this.resolveErrorMessage(error);
      },
    });
  }

  cancelForm(): void {
    this.showForm = false;
    this.selectedCliente = null;
    this.clearMessages();
  }

  fullName(cliente: Cliente): string {
    return `${cliente.nombres} ${cliente.apellidos}`;
  }

  private clearMessages(): void {
    this.feedbackMessage = '';
    this.errorMessage = '';
  }

  private syncClienteInList(cliente: Cliente): void {
    const clienteIndex = this.clientes.findIndex(
      (item) => item.id === cliente.id,
    );

    if (clienteIndex >= 0) {
      this.clientes = this.clientes.map((item) =>
        item.id === cliente.id ? cliente : item,
      );
      return;
    }

    this.clientes = [cliente, ...this.clientes];
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
