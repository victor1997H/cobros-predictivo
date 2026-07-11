import { Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  login(email: string, password: string) {
    const success = Boolean(email && password);

    return {
      success,
      message: success ? 'Login correcto' : 'Credenciales incompletas',
      usuario: success
        ? {
            id: 1,
            nombre: 'Administrador',
            email,
          }
        : null,
    };
  }

  register(data: RegisterDto) {
    return {
      success: true,
      message: 'Usuario registrado',
      usuario: {
        id: 1,
        nombre: data.nombre,
        email: data.email,
      },
    };
  }
}
