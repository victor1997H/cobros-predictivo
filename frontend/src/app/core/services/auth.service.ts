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

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  usuario: AuthUser | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly currentUserKey = 'cobros_current_user';
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

  setCurrentUser(user: AuthUser, remember: boolean): void {
    this.clearStoredUser();

    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(this.currentUserKey, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  clearSession(): void {
    this.clearStoredUser();
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  private loadStoredUser(): AuthUser | null {
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
  }
}
