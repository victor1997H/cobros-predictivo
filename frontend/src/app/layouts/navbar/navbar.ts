import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService, AuthUser } from '../../core/services/auth.service';
import { NotificacionTiempoRealService } from '../../core/services/notificacion-tiempo-real.service';
import { ThemeService } from '../../core/services/theme.service';

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
  imports: [AsyncPipe, DatePipe, RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly notificacionService = inject(NotificacionTiempoRealService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser$ = this.authService.currentUser$;
  readonly isDarkMode = this.themeService.isDarkMode;
  readonly notificaciones = this.notificacionService.notificaciones;
  readonly unreadCount = this.notificacionService.unreadCount;
  readonly notificationsLoading = this.notificacionService.isLoading;
  readonly notificationsError = this.notificacionService.errorMessage;
  readonly pageHeader = signal(this.resolvePageHeader(this.router.url));
  readonly isUserMenuOpen = signal(false);
  readonly isNotificationsOpen = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.pageHeader.set(this.resolvePageHeader(event.urlAfterRedirects));
        this.isUserMenuOpen.set(false);
        this.isNotificationsOpen.set(false);
      });
  }

  ngOnInit(): void {
    this.notificacionService.start();
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

  toggleTheme(): void {
    this.themeService.toggleMode();
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update((isOpen) => !isOpen);
    this.isNotificationsOpen.set(false);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  toggleNotifications(): void {
    this.isNotificationsOpen.update((isOpen) => {
      const nextState = !isOpen;

      if (nextState) {
        this.notificacionService.markAsRead();
      }

      return nextState;
    });
    this.isUserMenuOpen.set(false);
  }

  refreshNotifications(): void {
    this.notificacionService.refresh();
  }

  private resolvePageHeader(url: string): PageHeader {
    const path = url.split('?')[0].split('#')[0];

    return PAGE_HEADERS[path] ?? PAGE_HEADERS['/dashboard'];
  }
}
