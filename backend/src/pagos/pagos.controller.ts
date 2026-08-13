import { Body, Controller, Get, Post } from '@nestjs/common';

import { CreatePagoDto } from './dto/create-pago.dto';
import { PagosService } from './pagos.service';

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Get()
  findAll() {
    return this.pagosService.findAll();
  }

  @Post()
  create(@Body() body: CreatePagoDto) {
    return this.pagosService.create(body);
  }
}
