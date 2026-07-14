import { Injectable } from '@nestjs/common';

export interface AppStatusResponse {
  success: boolean;
  application: string;
  description: string;
  framework: string;
  database: string;
  status: string;
  version: string;
  environment: string;
  server_time: string;
  author: string;
  endpoints: {
    login: string;
    register: string;
  };
}

@Injectable()
export class AppService {
  getHello(): AppStatusResponse {
    return {
      success: true,
      application: 'Sistema de Gesti\u00f3n de Cobros Predictivo',
      description:
        'API REST para la gesti\u00f3n inteligente de cartera y automatizaci\u00f3n de cobros.',
      framework: 'NestJS',
      database: 'PostgreSQL',
      status: 'Operativo',
      version: '1.0.0',
      environment: 'Production',
      server_time: new Date().toISOString(),
      author: 'Victor Daniel Hualpa Yaqueno',
      endpoints: {
        login: '/auth/login',
        register: '/auth/register',
      },
    };
  }
}
