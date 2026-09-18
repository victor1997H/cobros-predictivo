import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateClienteDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  nombres?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  apellidos?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{10}$/, {
    message: 'La identificacion debe tener exactamente 10 digitos numericos',
  })
  identificacion?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(160)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  telefono?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  direccion?: string | null;

  @IsBoolean()
  @IsOptional()
  estado?: boolean;
}
