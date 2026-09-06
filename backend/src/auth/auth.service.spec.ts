import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { JwtTokenService } from './services/jwt-token.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: {
    findByEmail: jest.Mock;
    findByEmailWithPassword: jest.Mock;
    findByResetTokenHash: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let jwtTokenService: {
    signUser: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findByEmail: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      findByResetTokenHash: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    jwtTokenService = {
      signUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: userRepository,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: NotificacionesService,
          useValue: {
            enviarCorreoSistema: jest.fn(),
          },
        },
        {
          provide: JwtTokenService,
          useValue: jwtTokenService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('devuelve un JWT al iniciar sesion con credenciales correctas', async () => {
    const password = await bcrypt.hash('clave-correcta', 10);
    const user = {
      id: 1,
      nombre: 'Usuario Prueba',
      email: 'usuario@example.com',
      password,
    } as User;

    userRepository.findByEmailWithPassword.mockResolvedValue(user);
    jwtTokenService.signUser.mockReturnValue('jwt.valido.prueba');

    const response = await service.login(
      'usuario@example.com',
      'clave-correcta',
    );

    expect(response).toEqual({
      success: true,
      message: 'Login correcto',
      usuario: {
        id: 1,
        nombre: 'Usuario Prueba',
        email: 'usuario@example.com',
      },
      token: 'jwt.valido.prueba',
    });
    expect(jwtTokenService.signUser).toHaveBeenCalledWith({
      id: 1,
      nombre: 'Usuario Prueba',
      email: 'usuario@example.com',
    });
  });

  it('rechaza login con credenciales incorrectas', async () => {
    const password = await bcrypt.hash('clave-correcta', 10);
    const user = {
      id: 1,
      nombre: 'Usuario Prueba',
      email: 'usuario@example.com',
      password,
    } as User;

    userRepository.findByEmailWithPassword.mockResolvedValue(user);

    await expect(
      service.login('usuario@example.com', 'clave-incorrecta'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
