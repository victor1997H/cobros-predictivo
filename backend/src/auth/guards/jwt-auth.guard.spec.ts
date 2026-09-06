import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import type { Response } from 'supertest';
import { App } from 'supertest/types';

import { AppController } from '../../app.controller';
import { AppService } from '../../app.service';
import { ClientesController } from '../../clientes/clientes.controller';
import { ClientesService } from '../../clientes/clientes.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtTokenService } from '../services/jwt-token.service';
import { JwtStrategy } from '../strategies/jwt.strategy';

describe('JwtAuthGuard', () => {
  let app: INestApplication<App>;
  let jwtTokenService: JwtTokenService;
  const clientesResponse = {
    success: true,
    message: 'Clientes obtenidos correctamente',
    clientes: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController, ClientesController],
      providers: [
        JwtTokenService,
        JwtStrategy,
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'JWT_SECRET') {
                return 'jwt-test-secret';
              }

              return undefined;
            },
          },
        },
        {
          provide: AppService,
          useValue: {
            getHello: () => ({
              success: true,
              application: 'Sistema de Gestión de Cobros Predictivo',
              endpoints: {
                login: '/auth/login',
                register: '/auth/register',
              },
              server_time: new Date().toISOString(),
            }),
            getHealth: () =>
              Promise.resolve({
                status: 'ok',
                service: 'cobros-backend',
                buildSha: 'test',
                database: 'ok',
                server_time: new Date().toISOString(),
              }),
          },
        },
        {
          provide: ClientesService,
          useValue: {
            findAll: () => clientesResponse,
            remove: () => ({
              success: true,
              message: 'Cliente eliminado correctamente',
            }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    jwtTokenService = module.get(JwtTokenService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('responde 401 al consultar clientes sin token', () => {
    return request(app.getHttpServer()).get('/clientes').expect(401);
  });

  it('permite consultar clientes con token valido', () => {
    const token = jwtTokenService.signUser({
      id: 1,
      nombre: 'Usuario Prueba',
      email: 'usuario@example.com',
    });

    return request(app.getHttpServer())
      .get('/clientes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(clientesResponse);
  });

  it('responde 401 al eliminar clientes sin token', () => {
    return request(app.getHttpServer()).delete('/clientes/1').expect(401);
  });

  it('mantiene health publico', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as { status?: string; database?: string };

        expect(body.status).toBe('ok');
        expect(body.database).toBe('ok');
      });
  });
});
