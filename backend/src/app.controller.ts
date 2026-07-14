import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { AppStatusResponse } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): AppStatusResponse {
    return this.appService.getHello();
  }
}
