import { AsyncPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { ClienteService } from '../../../../core/services/cliente.service';
import { Cliente } from '../../../clientes/models/cliente.model';

@Component({
  selector: 'app-dashboard-home',
  imports: [AsyncPipe],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
})
export class DashboardHome implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly clienteService = inject(ClienteService);

  readonly currentUser$ = this.authService.currentUser$;

  clientes: Cliente[] = [];
  ultimosClientes: Cliente[] = [];
  isLoading = false;
  errorMessage = '';

  get totalClientes(): number {
    return this.clientes.length;
  }

  get clientesActivos(): number {
    return this.clientes.filter((cliente) => cliente.estado).length;
  }

  get clientesInactivos(): number {
    return this.clientes.filter((cliente) => !cliente.estado).length;
  }

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
          this.ultimosClientes = response.clientes.slice(0, 5);
        },
        error: (error: unknown) => {
          this.errorMessage = this.resolveErrorMessage(error);
        },
      });
  }

  fullName(cliente: Cliente): string {
    return `${cliente.nombres} ${cliente.apellidos}`;
  }

  private resolveErrorMessage(error: unknown): string {
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
