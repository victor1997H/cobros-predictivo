import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

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

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  service: string;
  buildSha: string;
  database: 'ok' | 'error';
  server_time: string;
}

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

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

  async getHealth(): Promise<HealthCheckResponse> {
    const buildSha = this.getBuildSha();

    try {
      await this.dataSource.query('SELECT 1');

      return {
        status: 'ok',
        service: 'cobros-backend',
        buildSha,
        database: 'ok',
        server_time: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'cobros-backend',
        buildSha,
        database: 'error',
        server_time: new Date().toISOString(),
      });
    }
  }

  private getBuildSha(): string {
    const buildSha = process.env.BUILD_SHA?.trim();

    return buildSha && buildSha.length > 0 ? buildSha : 'local';
  }
}
