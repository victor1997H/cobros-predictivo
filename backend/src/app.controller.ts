import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { AppStatusResponse, HealthCheckResponse } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): AppStatusResponse {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): Promise<HealthCheckResponse> {
    return this.appService.getHealth();
  }
}
