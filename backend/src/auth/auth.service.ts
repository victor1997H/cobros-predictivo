import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';

@Injectable()
export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

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

  private toAuthUser(user: User): AuthUserDto {
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
    };
  }
}
