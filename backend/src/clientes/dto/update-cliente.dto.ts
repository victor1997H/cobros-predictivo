import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
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
  @MaxLength(30)
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
