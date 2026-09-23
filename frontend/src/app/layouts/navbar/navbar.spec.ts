import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { AuthService, AuthUser } from '../../core/services/auth.service';
import {
  NotificacionSistema,
  NotificacionTiempoRealService,
} from '../../core/services/notificacion-tiempo-real.service';
import { ThemeService } from '../../core/services/theme.service';
import { Navbar } from './navbar';

describe('Navbar', () => {
  let fixture: ComponentFixture<Navbar>;
  let component: Navbar;
  let router: Router;

  const currentUser$ = new BehaviorSubject<AuthUser>({
    id: 1,
    nombre: 'Victor Hualpa',
    email: 'vdy.hualpa@yavirac.edu.ec',
  });

  const notificaciones = signal<NotificacionSistema[]>([]);
  const activeAlertCount = signal(0);
  const notificationsLoading = signal(false);
  const notificationsError = signal('');

  const authService = {
    currentUser$: currentUser$.asObservable(),
    clearSession: vi.fn(),
    forgotPassword: vi.fn(() => of({ message: 'Enlace enviado.' })),
  };

  const notificationService = {
    notificaciones,
    activeAlertCount,
    isLoading: notificationsLoading,
    errorMessage: notificationsError,
    start: vi.fn(),
    refresh: vi.fn(),
    markAsRead: vi.fn(),
  };

  const themeService = {
    isDarkMode: signal(false),
    toggleMode: vi.fn(),
  };

  beforeEach(async () => {
    notificaciones.set([]);
    activeAlertCount.set(0);
    notificationsLoading.set(false);
    notificationsError.set('');
    notificationService.start.mockClear();
    notificationService.refresh.mockClear();
    notificationService.markAsRead.mockClear();
    authService.clearSession.mockClear();
    authService.forgotPassword.mockClear();
    themeService.toggleMode.mockClear();

    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: NotificacionTiempoRealService, useValue: notificationService },
        { provide: ThemeService, useValue: themeService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('inicia la consulta de alertas activas', () => {
    expect(notificationService.start).toHaveBeenCalledTimes(1);
  });

  it('muestra el contador de alertas activas', () => {
    activeAlertCount.set(3);
    fixture.detectChanges();

    const counter = fixture.nativeElement.querySelector('.notification-count');

    expect(counter?.textContent.trim()).toBe('3');
  });

  it('abre y cierra el panel de notificaciones', () => {
    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('.notification-button');

    button.click();
    fixture.detectChanges();

    expect(component.isNotificationsOpen()).toBeTruthy();
    expect(notificationService.refresh).toHaveBeenCalledTimes(1);

    component.onEscape();
    fixture.detectChanges();

    expect(component.isNotificationsOpen()).toBeFalsy();
  });

  it('cierra el panel al hacer clic fuera del navbar', () => {
    component.toggleNotifications();
    fixture.detectChanges();

    component.onDocumentClick({
      target: document.body,
    } as unknown as MouseEvent);

    expect(component.isNotificationsOpen()).toBeFalsy();
  });

  it('navega al centro de seguimiento con la cuota seleccionada', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    notificaciones.set([
      {
        id: 50,
        cuotaId: 15,
        leida: false,
        titulo: 'Alerta urgente',
        detalle: 'Socio Prueba - 120 dias de mora',
        estado: 'ENVIADO',
        riesgo: 'CRITICO',
        prioridad: 'MAXIMA',
        tipoAlerta: 'ALERTA_CRITICA',
        accionRecomendada: 'Contacto inmediato',
        requiereIntervencionHumana: true,
        esAlertaInterna: true,
        fecha: '2026-09-21T10:00:00.000Z',
      },
    ]);
    activeAlertCount.set(1);
    fixture.detectChanges();

    component.toggleNotifications();
    fixture.detectChanges();

    const notification: HTMLButtonElement =
      fixture.nativeElement.querySelector('.notification-item');

    notification.click();

    expect(notificationService.markAsRead).toHaveBeenCalledWith(50);
    expect(navigateSpy).toHaveBeenCalledWith(['/configuracion'], {
      queryParams: { cuotaId: 15 },
    });
    expect(component.isNotificationsOpen()).toBeFalsy();
  });
});
