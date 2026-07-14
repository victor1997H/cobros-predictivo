import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') ?? '127.0.0.1',
        port: Number(configService.get<string>('DB_PORT') ?? 5432),
        database:
          configService.get<string>('DB_NAME') ??
          configService.get<string>('POSTGRES_DB') ??
          'cobros_db',
        username:
          configService.get<string>('DB_USER') ??
          configService.get<string>('POSTGRES_USER') ??
          'cobros_admin',
        password:
          configService.get<string>('DB_PASSWORD') ??
          configService.get<string>('POSTGRES_PASSWORD') ??
          '',
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    AuthModule,
    ClientesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
