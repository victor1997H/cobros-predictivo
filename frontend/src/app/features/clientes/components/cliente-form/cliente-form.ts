import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { Cliente, ClientePayload } from '../../models/cliente.model';

@Component({
  selector: 'app-cliente-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './cliente-form.html',
  styleUrl: './cliente-form.scss',
})
export class ClienteForm implements OnChanges {
  @Input() cliente: Cliente | null = null;
  @Input() isSaving = false;

  @Output() save = new EventEmitter<ClientePayload>();
  @Output() cancel = new EventEmitter<void>();

  private readonly formBuilder = inject(FormBuilder);

  readonly form = this.formBuilder.nonNullable.group({
    nombres: ['', [Validators.required, Validators.maxLength(120)]],
    apellidos: ['', [Validators.required, Validators.maxLength(120)]],
    identificacion: ['', [Validators.required, Validators.maxLength(30)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    telefono: ['', [Validators.required, Validators.maxLength(30)]],
    direccion: ['', [Validators.maxLength(255)]],
    estado: [true],
  });

  ngOnChanges(): void {
    if (this.cliente) {
      this.form.reset({
        nombres: this.cliente.nombres,
        apellidos: this.cliente.apellidos,
        identificacion: this.cliente.identificacion,
        email: this.cliente.email,
        telefono: this.cliente.telefono,
        direccion: this.cliente.direccion ?? '',
        estado: this.cliente.estado,
      });
      return;
    }

    this.form.reset({
      nombres: '',
      apellidos: '',
      identificacion: '',
      email: '',
      telefono: '',
      direccion: '',
      estado: true,
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.save.emit({
      ...value,
      direccion: value.direccion.trim() || null,
    });
  }
}
