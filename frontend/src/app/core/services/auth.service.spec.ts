import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('guarda el usuario y el JWT al iniciar sesion', () => {
    const token = createToken({ exp: Math.floor(Date.now() / 1000) + 3600 });

    service.setCurrentUser(
      {
        id: 1,
        nombre: 'Usuario Prueba',
        email: 'usuario@example.com',
      },
      true,
      token,
    );

    expect(service.getCurrentUser()?.email).toBe('usuario@example.com');
    expect(service.getToken()).toBe(token);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('limpia la sesion si el JWT expiro', () => {
    const token = createToken({ exp: Math.floor(Date.now() / 1000) - 10 });

    service.setCurrentUser(
      {
        id: 1,
        nombre: 'Usuario Prueba',
        email: 'usuario@example.com',
      },
      true,
      token,
    );

    expect(service.getToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });
});

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
