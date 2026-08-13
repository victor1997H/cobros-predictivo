import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Cuota } from '../cuotas/entities/cuota.entity';
import { CuotaRepository } from '../cuotas/repositories/cuota.repository';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { GestionCobranza } from './entities/gestion-cobranza.entity';
import { GestionesCobranzaController } from './gestiones-cobranza.controller';
import { GestionesCobranzaService } from './gestiones-cobranza.service';
import { GestionCobranzaRepository } from './repositories/gestion-cobranza.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([GestionCobranza, Cuota]),
    NotificacionesModule,
  ],
  controllers: [GestionesCobranzaController],
  providers: [
    GestionesCobranzaService,
    GestionCobranzaRepository,
    CuotaRepository,
  ],
})
export class GestionesCobranzaModule {}
