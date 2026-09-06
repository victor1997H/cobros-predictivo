import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  usuario: AuthUser | null;
  token: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly currentUserKey = 'cobros_current_user';
  private readonly authTokenKey = 'cobros_auth_token';
  private readonly http = inject(HttpClient);
  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(
    this.loadStoredUser(),
  );

  readonly currentUser$ = this.currentUserSubject.asObservable();

  private readonly apiUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3000/auth'
      : 'https://backsistemacobros.byronrm.com/auth';

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, data);
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data);
  }

  forgotPassword(
    data: ForgotPasswordRequest,
  ): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/forgot-password`,
      data,
    );
  }

  resetPassword(
    data: ResetPasswordRequest,
  ): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/reset-password`,
      data,
    );
  }

  setCurrentUser(user: AuthUser, remember: boolean, token: string | null): void {
    this.clearStoredUser();

    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(this.currentUserKey, JSON.stringify(user));
    storage.setItem(this.authTokenKey, token ?? '');
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    const token =
      localStorage.getItem(this.authTokenKey) ??
      sessionStorage.getItem(this.authTokenKey);

    if (!token || this.isTokenExpired(token)) {
      this.clearSession();
      return null;
    }

    return token;
  }

  clearSession(): void {
    this.clearStoredUser();
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null && this.getToken() !== null;
  }

  private loadStoredUser(): AuthUser | null {
    const token =
      localStorage.getItem(this.authTokenKey) ??
      sessionStorage.getItem(this.authTokenKey);

    if (!token || this.isTokenExpired(token)) {
      this.clearStoredUser();
      return null;
    }

    const storedUser =
      localStorage.getItem(this.currentUserKey) ??
      sessionStorage.getItem(this.currentUserKey);

    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser) as AuthUser;
    } catch {
      this.clearStoredUser();
      return null;
    }
  }

  private clearStoredUser(): void {
    localStorage.removeItem(this.currentUserKey);
    sessionStorage.removeItem(this.currentUserKey);
    localStorage.removeItem(this.authTokenKey);
    sessionStorage.removeItem(this.authTokenKey);
  }

  private isTokenExpired(token: string): boolean {
    const payload = this.decodeJwtPayload(token);

    if (!payload || typeof payload.exp !== 'number') {
      return true;
    }

    return payload.exp <= Math.floor(Date.now() / 1000);
  }

  private decodeJwtPayload(token: string): { exp?: number } | null {
    const [, payloadSegment] = token.split('.');

    if (!payloadSegment) {
      return null;
    }

    try {
      const normalizedPayload = payloadSegment
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const paddedPayload = normalizedPayload.padEnd(
        normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
        '=',
      );
      const jsonPayload = decodeURIComponent(
        atob(paddedPayload)
          .split('')
          .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join(''),
      );

      return JSON.parse(jsonPayload) as { exp?: number };
    } catch {
      return null;
    }
  }
}
