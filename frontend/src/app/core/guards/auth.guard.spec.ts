import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('permite acceder al dashboard con JWT vigente', () => {
    const token = createToken({ exp: Math.floor(Date.now() / 1000) + 3600 });

    authService.setCurrentUser(
      {
        id: 1,
        nombre: 'Usuario Prueba',
        email: 'usuario@example.com',
      },
      true,
      token,
    );

    const result = runGuard('/dashboard');

    expect(result).toBe(true);
  });

  it('redirige a login cuando no existe JWT', () => {
    const result = runGuard('/dashboard');

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe(
      '/login?returnUrl=%2Fdashboard',
    );
  });
});

function runGuard(url: string) {
  return TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
}

function createToken(payload: { exp: number }): string {
  return [
    toBase64Url({ alg: 'HS256', typ: 'JWT' }),
    toBase64Url(payload),
    'firma-prueba',
  ].join('.');
}

function toBase64Url(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
