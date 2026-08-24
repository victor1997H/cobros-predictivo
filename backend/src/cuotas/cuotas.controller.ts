import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { CreateCuotaDto } from './dto/create-cuota.dto';
import { UpdateCuotaDto } from './dto/update-cuota.dto';
import { CuotasService } from './cuotas.service';

@Controller('cuotas')
export class CuotasController {
  constructor(private readonly cuotasService: CuotasService) {}

  @Get()
  findAll() {
    return this.cuotasService.findAll();
  }

  @Get('gestion-cobranza')
  findGestionCobranza() {
    return this.cuotasService.findGestionCobranza();
  }

  @Get('pendientes-para-pago')
  findPendientesParaPago() {
    return this.cuotasService.findPendientesParaPago();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cuotasService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateCuotaDto) {
    return this.cuotasService.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCuotaDto) {
    return this.cuotasService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.cuotasService.remove(id);
  }
}
