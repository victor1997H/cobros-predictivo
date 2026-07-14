import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { ClienteService } from '../../../../core/services/cliente.service';
import { Cliente } from '../../../clientes/models/cliente.model';

@Component({
  selector: 'app-dashboard-home',
  imports: [AsyncPipe],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHome implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly clienteService = inject(ClienteService);

  readonly currentUser$ = this.authService.currentUser$;
  readonly clientes = signal<Cliente[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly totalClientes = computed(() => this.clientes().length);
  readonly clientesActivos = computed(
    () => this.clientes().filter((cliente) => cliente.estado).length,
  );
  readonly clientesInactivos = computed(
    () => this.clientes().filter((cliente) => !cliente.estado).length,
  );
  readonly ultimosClientes = computed(() => this.clientes().slice(0, 5));

  ngOnInit(): void {
    this.loadClientes();
  }

  loadClientes(): void {
    this.isLoading.set(true);
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

  fullName(cliente: Cliente): string {
    return `${cliente.nombres} ${cliente.apellidos}`;
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

    return 'No se pudo cargar la informacion del dashboard.';
  }
}
