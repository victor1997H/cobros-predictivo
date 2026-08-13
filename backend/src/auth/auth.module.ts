import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User]), NotificacionesModule],
  controllers: [AuthController],
  providers: [AuthService, UserRepository],
})
export class AuthModule {}
