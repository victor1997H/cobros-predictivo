import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService, AuthUser } from '../../../../core/services/auth.service';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authService: {
    login: ReturnType<typeof vi.fn>;
    forgotPassword: ReturnType<typeof vi.fn>;
    setCurrentUser: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  const usuario: AuthUser = {
    id: 1,
    nombre: 'Usuario Prueba',
    email: 'usuario@example.com',
  };

  beforeEach(async () => {
    authService = {
      login: vi.fn(),
      forgotPassword: vi.fn(),
      setCurrentUser: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('guarda JWT y permite navegar al dashboard al iniciar sesion', () => {
    authService.login.mockReturnValue(
      of({
        success: true,
        message: 'Login correcto',
        usuario,
        token: 'jwt.valido.prueba',
      }),
    );
    component.loginForm.setValue({
      email: 'usuario@example.com',
      password: 'clave-correcta',
      remember: true,
    });

    component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith({
      email: 'usuario@example.com',
      password: 'clave-correcta',
    });
    expect(authService.setCurrentUser).toHaveBeenCalledWith(
      usuario,
      true,
      'jwt.valido.prueba',
    );
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
