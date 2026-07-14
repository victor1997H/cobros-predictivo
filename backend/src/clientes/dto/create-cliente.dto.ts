import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombres!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  apellidos!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  identificacion!: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(160)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  telefono!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  direccion?: string | null;

  @IsBoolean()
  @IsOptional()
  estado?: boolean;
}
