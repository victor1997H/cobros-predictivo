import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { authTokenInterceptor } from './auth-token.interceptor';

describe('authTokenInterceptor', () => {
  let authService: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authTokenInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    authService = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('envia Authorization Bearer en peticiones privadas', () => {
    const token = createToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const http = TestBed.inject(HttpClient);

    authService.setCurrentUser(
      {
        id: 1,
        nombre: 'Usuario Prueba',
        email: 'usuario@example.com',
      },
      true,
      token,
    );

    http.get('http://localhost:3000/clientes').subscribe();

    const request = httpMock.expectOne('http://localhost:3000/clientes');

    expect(request.request.headers.get('Authorization')).toBe(
      `Bearer ${token}`,
    );

    request.flush({
      success: true,
      message: 'Clientes obtenidos correctamente',
      clientes: [],
    });
  });

  it('no envia Authorization en login', () => {
    const token = createToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const http = TestBed.inject(HttpClient);

    authService.setCurrentUser(
      {
        id: 1,
        nombre: 'Usuario Prueba',
        email: 'usuario@example.com',
      },
      true,
      token,
    );

    http
      .post('http://localhost:3000/auth/login', {
        email: 'usuario@example.com',
        password: 'clave',
      })
      .subscribe();

    const request = httpMock.expectOne('http://localhost:3000/auth/login');

    expect(request.request.headers.has('Authorization')).toBe(false);

    request.flush({
      success: true,
      message: 'Login correcto',
      usuario: {
        id: 1,
        nombre: 'Usuario Prueba',
        email: 'usuario@example.com',
      },
      token,
    });
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
