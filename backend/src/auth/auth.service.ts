import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly configService: ConfigService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.userRepository.findByEmailWithPassword(email);

    if (!user) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const passwordValido = await bcrypt.compare(password, user.password);

    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    return {
      success: true,
      message: 'Login correcto',
      usuario: this.toAuthUser(user),
    };
  }

  async register(data: RegisterDto): Promise<AuthResponseDto> {
    const usuarioExistente = await this.userRepository.findByEmail(data.email);

    if (usuarioExistente) {
      throw new ConflictException('El email ya esta registrado');
    }

    const passwordEncriptado = await bcrypt.hash(data.password, 10);
    const user = this.userRepository.create({
      nombre: data.nombre,
      email: data.email,
      password: passwordEncriptado,
    });
    const savedUser = await this.userRepository.save(user);

    return {
      success: true,
      message: 'Usuario registrado',
      usuario: this.toAuthUser(savedUser),
    };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findByEmail(email);
    const response = {
      success: true,
      message:
        'Si el correo existe, recibira un enlace para restablecer su contrasena.',
    };

    if (!user) {
      return response;
    }

    const token = randomBytes(32).toString('hex');
    user.resetPasswordTokenHash = this.hashToken(token);
    user.resetPasswordExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.userRepository.save(user);

    await this.notificacionesService.enviarCorreoSistema({
      destinatario: user.email,
      asunto: 'CobrosPredictivo - restablecer contrasena',
      mensaje: this.buildResetPasswordMessage(user.nombre, token),
    });

    return response;
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = this.hashToken(token);
    const user = await this.userRepository.findByResetTokenHash(tokenHash);

    if (!user || !user.resetPasswordExpiresAt) {
      throw new BadRequestException('El enlace no es valido o ya expiro');
    }

    if (user.resetPasswordExpiresAt.getTime() < Date.now()) {
      user.resetPasswordTokenHash = null;
      user.resetPasswordExpiresAt = null;
      await this.userRepository.save(user);
      throw new BadRequestException('El enlace no es valido o ya expiro');
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Contrasena actualizada correctamente',
    };
  }

  private toAuthUser(user: User): AuthUserDto {
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildResetPasswordMessage(nombre: string, token: string): string {
    const url = `${this.getFrontendUrl()}/reset-password?token=${token}`;

    return [
      `Hola ${nombre},`,
      '',
      'Recibimos una solicitud para restablecer tu contrasena en CobrosPredictivo.',
      'Ingresa al siguiente enlace para crear una nueva contrasena:',
      '',
      url,
      '',
      'Este enlace vence en 15 minutos.',
      'Si no solicitaste este cambio, ignora este correo.',
    ].join('\n');
  }

  private getFrontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:4200'
    ).replace(/\/$/, '');
  }
}
