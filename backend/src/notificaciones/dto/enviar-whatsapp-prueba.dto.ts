import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EnviarWhatsappPruebaDto {
  @IsString()
  @MaxLength(30)
  telefono!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mensaje?: string;
}
