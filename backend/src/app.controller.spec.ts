import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
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
});
