export interface JwtPayload {
  sub: number;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
}
