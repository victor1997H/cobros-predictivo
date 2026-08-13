import { Body, Controller, Post } from '@nestjs/common';

import { EnviarCorreoPruebaDto } from './dto/enviar-correo-prueba.dto';
import { EnviarWhatsappPruebaDto } from './dto/enviar-whatsapp-prueba.dto';
import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Post('correo-prueba')
  enviarCorreoPrueba(@Body() body: EnviarCorreoPruebaDto) {
    return this.notificacionesService.enviarCorreoPrueba(body);
  }

  @Post('whatsapp-prueba')
  enviarWhatsappPrueba(@Body() body: EnviarWhatsappPruebaDto) {
    return this.notificacionesService.enviarWhatsappPrueba(body);
  }
}
