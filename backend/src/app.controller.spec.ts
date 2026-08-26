import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let dataSource: { query: jest.Mock };
  const originalBuildSha = process.env.BUILD_SHA;

  beforeEach(async () => {
    dataSource = {
      query: jest.fn().mockResolvedValue([{ result: 1 }]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(() => {
    process.env.BUILD_SHA = originalBuildSha;
  });

  describe('root', () => {
    it('should return the application status response', () => {
      const response = appController.getHello();

      expect(response.success).toBe(true);
      expect(response.application).toBe(
        'Sistema de Gesti\u00f3n de Cobros Predictivo',
      );
      expect(response.endpoints).toEqual({
        login: '/auth/login',
        register: '/auth/register',
      });
      expect(response.server_time).toBeDefined();
    });
  });

  describe('health', () => {
    it('should return ok when PostgreSQL is available', async () => {
      process.env.BUILD_SHA = 'abc123';

      const response = await appController.getHealth();

      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(response).toMatchObject({
        status: 'ok',
        service: 'cobros-backend',
        buildSha: 'abc123',
        database: 'ok',
      });
      expect(response.server_time).toBeDefined();
    });

    it('should return local buildSha when BUILD_SHA is not defined', async () => {
      delete process.env.BUILD_SHA;

      const response = await appController.getHealth();

      expect(response.buildSha).toBe('local');
    });

    it('should fail without exposing internal PostgreSQL errors', async () => {
      process.env.BUILD_SHA = 'abc123';
      dataSource.query.mockRejectedValue(new Error('password secret detail'));

      expect.assertions(3);
      try {
        await appController.getHealth();
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);

        const response = (error as ServiceUnavailableException).getResponse();

        expect(response).toMatchObject({
          status: 'error',
          service: 'cobros-backend',
          buildSha: 'abc123',
          database: 'error',
        });
        expect(JSON.stringify(response)).not.toContain(
          'password secret detail',
        );
      }
    });
  });
});
