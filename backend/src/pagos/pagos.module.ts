import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Cuota } from '../cuotas/entities/cuota.entity';
import { CuotaRepository } from '../cuotas/repositories/cuota.repository';
import { Pago } from './entities/pago.entity';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { PagoRepository } from './repositories/pago.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Pago, Cuota])],
  controllers: [PagosController],
  providers: [PagosService, PagoRepository, CuotaRepository],
})
export class PagosModule {}
