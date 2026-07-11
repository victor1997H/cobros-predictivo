export class AuthUserDto {
  id!: number;
  nombre!: string;
  email!: string;
}

export class AuthResponseDto {
  success!: boolean;
  message!: string;
  usuario!: AuthUserDto | null;
}
