import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { PAGO_METODOS } from '../entities/pago.entity';
import type { PagoMetodo } from '../entities/pago.entity';

export class CreatePagoDto {
  @IsInt()
  @Min(1)
  cuotaId!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto!: number;

  @IsDateString()
  @IsOptional()
  fechaPago?: string;

  @IsIn(PAGO_METODOS)
  @IsOptional()
  metodoPago?: PagoMetodo;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(120)
  referencia?: string | null;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(255)
  observacion?: string | null;
}
