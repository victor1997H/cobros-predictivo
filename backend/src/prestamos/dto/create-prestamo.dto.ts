import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePrestamoDto {
  @IsInt()
  @Min(1)
  clienteId!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto!: number;

  @IsDateString()
  @IsNotEmpty()
  fechaInicio!: string;

  @IsInt()
  @Min(1)
  numeroCuotas!: number;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  estado?: string;

  @IsBoolean()
  @IsOptional()
  generarCuotas?: boolean;

  @IsDateString()
  @IsOptional()
  fechaPrimerVencimiento?: string;
}
