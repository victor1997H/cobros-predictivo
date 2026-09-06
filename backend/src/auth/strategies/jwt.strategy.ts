import { Injectable } from '@nestjs/common';

import {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/jwt-payload.interface';
import { JwtTokenService } from '../services/jwt-token.service';

@Injectable()
export class JwtStrategy {
  constructor(private readonly jwtTokenService: JwtTokenService) {}

  validate(token: string): AuthenticatedUser {
    const payload: JwtPayload = this.jwtTokenService.verify(token);

    return {
      id: payload.sub,
      email: payload.email,
    };
  }
}
