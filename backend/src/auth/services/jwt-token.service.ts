import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

import { AuthUserDto } from '../dto/auth-response.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtTokenService {
  private readonly runtimeSecret = randomBytes(32).toString('hex');
  private readonly defaultExpirationSeconds = 8 * 60 * 60;

  constructor(private readonly configService: ConfigService) {}

  signUser(user: AuthUserDto): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      iat: issuedAt,
      exp: issuedAt + this.getExpirationSeconds(),
    };

    return this.sign(payload);
  }

  verify(token: string): JwtPayload {
    const parts = token.split('.');

    if (parts.length !== 3) {
      throw new UnauthorizedException('Token de autenticacion invalido');
    }

    const [headerSegment, payloadSegment, signatureSegment] = parts;
    const header = this.decodeSegment<unknown>(headerSegment);

    if (!this.isValidHeader(header)) {
      throw new UnauthorizedException('Token de autenticacion invalido');
    }

    const data = `${headerSegment}.${payloadSegment}`;
    const expectedSignature = this.createSignature(data);

    if (!this.signaturesMatch(expectedSignature, signatureSegment)) {
      throw new UnauthorizedException('Token de autenticacion invalido');
    }

    const payload = this.decodeSegment<unknown>(payloadSegment);

    if (!this.isValidPayload(payload)) {
      throw new UnauthorizedException('Token de autenticacion invalido');
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token de autenticacion expirado');
    }

    return payload;
  }

  private sign(payload: JwtPayload): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };
    const headerSegment = this.encodeSegment(header);
    const payloadSegment = this.encodeSegment(payload);
    const data = `${headerSegment}.${payloadSegment}`;

    return `${data}.${this.createSignature(data)}`;
  }

  private encodeSegment(value: unknown): string {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  }

  private decodeSegment<T>(segment: string): T {
    try {
      return JSON.parse(
        Buffer.from(segment, 'base64url').toString('utf8'),
      ) as T;
    } catch {
      throw new UnauthorizedException('Token de autenticacion invalido');
    }
  }

  private createSignature(data: string): string {
    return createHmac('sha256', this.getSecret())
      .update(data)
      .digest('base64url');
  }

  private signaturesMatch(expected: string, received: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);

    return (
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  }

  private isValidHeader(header: unknown): header is { alg: 'HS256' } {
    return (
      typeof header === 'object' &&
      header !== null &&
      'alg' in header &&
      header.alg === 'HS256'
    );
  }

  private isValidPayload(payload: unknown): payload is JwtPayload {
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }

    const candidate = payload as Record<string, unknown>;

    return (
      Number.isInteger(candidate['sub']) &&
      typeof candidate['email'] === 'string' &&
      candidate['email'].length > 0 &&
      Number.isInteger(candidate['iat']) &&
      Number.isInteger(candidate['exp'])
    );
  }

  private getSecret(): string {
    const configuredSecret =
      this.configService.get<string>('JWT_SECRET') ??
      this.configService.get<string>('AUTH_JWT_SECRET');

    return configuredSecret?.trim() || this.runtimeSecret;
  }

  private getExpirationSeconds(): number {
    const rawValue =
      this.configService.get<string>('JWT_EXPIRES_IN_SECONDS') ??
      this.configService.get<string>('AUTH_JWT_EXPIRES_IN_SECONDS');
    const parsedValue = Number(rawValue);

    if (Number.isInteger(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }

    return this.defaultExpirationSeconds;
  }
}
