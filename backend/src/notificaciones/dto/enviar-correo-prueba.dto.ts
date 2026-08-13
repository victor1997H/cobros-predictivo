import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class EnviarCorreoPruebaDto {
  @IsEmail()
  destinatario!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  asunto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mensaje?: string;
}
