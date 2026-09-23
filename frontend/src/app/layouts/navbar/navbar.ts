import { AsyncPipe, DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, finalize, timeout, TimeoutError } from 'rxjs';

import { AuthService, AuthUser } from '../../core/services/auth.service';
import {
  NotificacionSistema,
  NotificacionTiempoRealService,
} from '../../core/services/notificacion-tiempo-real.service';
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
    subtitle: 'Administra la informaci\u00f3n de los socios registrados.',
  },
  '/prestamos': {
    title: 'Pr\u00e9stamos',
    subtitle: 'Registra pr\u00e9stamos y genera sus cuotas.',
  },
  '/cuotas': {
    title: 'Cuotas',
    subtitle: 'Consulta vencimientos, saldos y estado de las cuotas.',
  },
  '/cobros': {
    title: 'Cobros',
    subtitle: 'Revisa las cuotas por cobrar y su nivel de riesgo.',
  },
  '/pagos': {
    title: 'Pagos',
    subtitle: 'Registra y consulta los pagos realizados.',
  },
  '/reportes': {
    title: 'Reportes',
    subtitle: 'Consulta el estado de la cartera, los cobros y la recaudaci\u00f3n.',
  },
  '/configuracion': {
    title: 'Centro de seguimiento',
    subtitle: 'Revisa los casos que necesitan atenci\u00f3n y las gestiones de cobro realizadas.',
  },
};

@Component({
  selector: 'app-navbar',
  imports: [AsyncPipe, DatePipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly notificacionService = inject(NotificacionTiempoRealService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly currentUser$ = this.authService.currentUser$;
  readonly isDarkMode = this.themeService.isDarkMode;
  readonly notificaciones = this.notificacionService.notificaciones;
  readonly activeAlertCount = this.notificacionService.activeAlertCount;
  readonly notificationsLoading = this.notificacionService.isLoading;
  readonly notificationsError = this.notificacionService.errorMessage;
  readonly pageHeader = signal(this.resolvePageHeader(this.router.url));
  readonly isUserMenuOpen = signal(false);
  readonly isNotificationsOpen = signal(false);
  readonly profilePhoto = signal<string | null>(null);
  readonly activeAccountSection = signal<'menu' | 'profile' | 'password'>('menu');
  readonly isSendingPasswordLink = signal(false);
  readonly accountMessage = signal('');
  readonly accountError = signal('');

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
        this.resetAccountMenu();
      });

    this.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.profilePhoto.set(user ? this.loadProfilePhoto(user) : null);
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
    this.isUserMenuOpen.update((isOpen) => {
      const nextState = !isOpen;

      if (nextState) {
        this.resetAccountMenu();
      }

      return nextState;
    });
    this.isNotificationsOpen.set(false);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
    this.resetAccountMenu();
  }

  toggleNotifications(): void {
    this.isNotificationsOpen.update((isOpen) => {
      const nextState = !isOpen;

      if (nextState) {
        this.notificacionService.refresh();
      }

      return nextState;
    });
    this.isUserMenuOpen.set(false);
  }

  closeNotifications(): void {
    this.isNotificationsOpen.set(false);
  }

  refreshNotifications(): void {
    this.notificacionService.refresh();
  }

  openNotificationCase(notificacion: NotificacionSistema): void {
    this.notificacionService.markAsRead(notificacion.id);
    this.closeNotifications();

    void this.router.navigate(['/configuracion'], {
      queryParams: { cuotaId: notificacion.cuotaId },
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.elementRef.nativeElement.contains(event.target as Node)) {
      return;
    }

    this.closeNotifications();
    this.closeUserMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeNotifications();
    this.closeUserMenu();
  }

  showAccountSection(section: 'menu' | 'profile' | 'password'): void {
    this.accountMessage.set('');
    this.accountError.set('');
    this.activeAccountSection.set(section);
  }

  onProfilePhotoSelected(event: Event, user: AuthUser): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.accountMessage.set('');
    this.accountError.set('');

    if (!file.type.startsWith('image/')) {
      this.accountError.set('Selecciona una imagen valida para tu perfil.');
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.accountError.set('La imagen no debe superar 2 MB.');
      input.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const photo = String(reader.result ?? '');

      localStorage.setItem(this.getProfilePhotoKey(user), photo);
      this.profilePhoto.set(photo);
      this.accountMessage.set('Foto de perfil actualizada.');
      input.value = '';
    };

    reader.onerror = () => {
      this.accountError.set('No se pudo cargar la imagen.');
      input.value = '';
    };

    reader.readAsDataURL(file);
  }

  removeProfilePhoto(user: AuthUser): void {
    localStorage.removeItem(this.getProfilePhotoKey(user));
    this.profilePhoto.set(null);
    this.accountMessage.set('Foto de perfil retirada.');
    this.accountError.set('');
  }

  requestPasswordChange(user: AuthUser): void {
    if (this.isSendingPasswordLink()) {
      return;
    }

    this.isSendingPasswordLink.set(true);
    this.accountMessage.set('');
    this.accountError.set('');

    this.authService
      .forgotPassword({ email: user.email })
      .pipe(
        timeout(15000),
        finalize(() => this.isSendingPasswordLink.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.accountMessage.set(response.message);
        },
        error: (error: unknown) => {
          this.accountError.set(this.resolveErrorMessage(error));
        },
      });
  }

  private resolvePageHeader(url: string): PageHeader {
    const path = url.split('?')[0].split('#')[0];

    return PAGE_HEADERS[path] ?? PAGE_HEADERS['/dashboard'];
  }

  private resetAccountMenu(): void {
    this.activeAccountSection.set('menu');
    this.accountMessage.set('');
    this.accountError.set('');
  }

  private loadProfilePhoto(user: AuthUser): string | null {
    return localStorage.getItem(this.getProfilePhotoKey(user));
  }

  private getProfilePhotoKey(user: AuthUser): string {
    return `cobros_profile_photo_${user.id}`;
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof TimeoutError) {
      return 'El servidor tardo demasiado en responder. Intenta nuevamente.';
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof error.error === 'object' &&
      error.error !== null &&
      'message' in error.error &&
      typeof error.error.message === 'string'
    ) {
      return error.error.message;
    }

    return 'No se pudo completar la solicitud.';
  }
}
