import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { finalize, timeout, TimeoutError } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    remember: [true],
  });

  readonly recoveryForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  isLoading = false;
  isRecoveringPassword = false;
  isRecoveryMode = false;
  errorMessage = '';
  infoMessage = '';
  recoveryErrorMessage = '';
  recoverySuccessMessage = '';
  showPassword = false;

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.infoMessage = '';

    const { email, password, remember } = this.loginForm.getRawValue();

    this.authService
      .login({ email, password })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            this.errorMessage = response.message;
            return;
          }

          if (!response.usuario) {
            this.errorMessage = 'No se recibio el usuario autenticado.';
            return;
          }

          this.authService.setCurrentUser(response.usuario, remember);
          void this.router.navigate(['/dashboard']);
        },
        error: (error: unknown) => {
          this.errorMessage = this.resolveErrorMessage(error);
        },
      });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  openRecoveryMode(): void {
    this.recoveryForm.controls.email.setValue(this.loginForm.controls.email.value);
    this.recoveryForm.markAsUntouched();
    this.errorMessage = '';
    this.infoMessage = '';
    this.recoveryErrorMessage = '';
    this.recoverySuccessMessage = '';
    this.isRecoveryMode = true;
  }

  closeRecoveryMode(): void {
    this.isRecoveryMode = false;
    this.isRecoveringPassword = false;
    this.recoveryErrorMessage = '';
    this.recoverySuccessMessage = '';
  }

  requestPasswordRecovery(): void {
    const emailControl = this.recoveryForm.controls.email;
    emailControl.markAsTouched();

    if (emailControl.invalid) {
      this.recoveryErrorMessage =
        'Ingresa un correo valido para enviar el enlace de recuperacion.';
      this.recoverySuccessMessage = '';
      return;
    }

    this.isRecoveringPassword = true;
    this.recoveryErrorMessage = '';
    this.recoverySuccessMessage = '';

    this.authService
      .forgotPassword({ email: emailControl.value })
      .pipe(
        timeout(15000),
        finalize(() => (this.isRecoveringPassword = false)),
      )
      .subscribe({
        next: (response) => {
          this.recoverySuccessMessage = response.message;
        },
        error: (error: unknown) => {
          this.recoveryErrorMessage = this.resolveErrorMessage(error);
        },
      });
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof TimeoutError) {
      return 'El servidor tardo demasiado en responder. Intenta nuevamente en unos segundos.';
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof error.error === 'object' &&
      error.error !== null &&
      'message' in error.error
    ) {
      const message = error.error.message;

      if (Array.isArray(message)) {
        return message.join(', ');
      }

      if (typeof message === 'string') {
        return message;
      }
    }

    return 'No se pudo conectar con el servidor.';
  }
}
