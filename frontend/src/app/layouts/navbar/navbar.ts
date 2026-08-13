import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService, AuthUser } from '../../core/services/auth.service';

interface PageHeader {
  title: string;
  subtitle: string;
}

const PAGE_HEADERS: Record<string, PageHeader> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Resumen general del sistema de cobros',
  },
  '/clientes': {
    title: 'Clientes',
    subtitle: 'Administra la cartera de clientes registrados',
  },
  '/cobros': {
    title: 'Cobros',
    subtitle: 'Gesti\u00f3n de cuotas vencidas y avisos preventivos',
  },
  '/pagos': {
    title: 'Pagos',
    subtitle: 'Registro y seguimiento de pagos de cuotas',
  },
  '/reportes': {
    title: 'Reportes',
    subtitle: 'Indicadores de cartera, cobranza y recaudaci\u00f3n',
  },
  '/configuracion': {
    title: 'Configuraci\u00f3n',
    subtitle: 'Estado de servicios e integraciones del sistema',
  },
};

@Component({
  selector: 'app-navbar',
  imports: [AsyncPipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser$ = this.authService.currentUser$;
  readonly pageHeader = signal(this.resolvePageHeader(this.router.url));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.pageHeader.set(this.resolvePageHeader(event.urlAfterRedirects));
      });
  }

  getInitials(user: AuthUser | null): string {
    if (!user?.nombre) {
      return 'CP';
    }

    return user.nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  logout(): void {
    this.authService.clearSession();
    void this.router.navigate(['/login']);
  }

  private resolvePageHeader(url: string): PageHeader {
    const path = url.split('?')[0].split('#')[0];

    return PAGE_HEADERS[path] ?? PAGE_HEADERS['/dashboard'];
  }
}
