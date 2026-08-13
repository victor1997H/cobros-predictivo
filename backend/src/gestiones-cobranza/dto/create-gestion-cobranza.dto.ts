import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { CanalNotificacion } from '../../notificaciones/notificaciones.service';

const CANALES_NOTIFICACION: CanalNotificacion[] = ['CORREO', 'WHATSAPP'];

export class CreateGestionCobranzaDto {
  @IsInt()
  @Min(1)
  cuotaId!: number;

  @IsString()
  tipoGestion!: string;

  @IsInt()
  @Min(0)
  diasAtraso!: number;

  @IsString()
  nivelRiesgo!: string;

  @IsString()
  prioridad!: string;

  @IsString()
  accion!: string;

  @IsString()
  mensaje!: string;

  @IsOptional()
  @IsString()
  modo?: string;

  @IsOptional()
  @IsString()
  fechaGestion?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(CANALES_NOTIFICACION, { each: true })
  canales?: CanalNotificacion[];
}
