import { Body, Controller, Get, Post } from '@nestjs/common';

import { CreateGestionCobranzaDto } from './dto/create-gestion-cobranza.dto';
import { GestionesCobranzaService } from './gestiones-cobranza.service';

@Controller('gestiones-cobranza')
export class GestionesCobranzaController {
  constructor(
    private readonly gestionesCobranzaService: GestionesCobranzaService,
  ) {}

  @Get()
  findAll() {
    return this.gestionesCobranzaService.findAll();
  }

  @Post()
  create(@Body() body: CreateGestionCobranzaDto) {
    return this.gestionesCobranzaService.create(body);
  }
}
