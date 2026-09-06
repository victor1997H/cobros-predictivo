import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientePayload } from '../../models/cliente.model';
import { ClienteForm } from './cliente-form';

describe('ClienteForm', () => {
  let component: ClienteForm;
  let fixture: ComponentFixture<ClienteForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClienteForm],
    }).compileComponents();

    fixture = TestBed.createComponent(ClienteForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it.each([
    ['0987545679', '+593987545679'],
    ['987545679', '+593987545679'],
    ['+593987545679', '+593987545679'],
    ['+593 98 754 5679', '+593987545679'],
  ])('emite el telefono %s normalizado como %s', (input, expected) => {
    const emittedPayloads: ClientePayload[] = [];
    component.save.subscribe((payload) => {
      emittedPayloads.push(payload);
    });
    fillValidForm(input);

    component.submit();

    expect(emittedPayloads[0]?.telefono).toBe(expected);
  });

  it.each(['abc123', '09875', '+593593987545679'])(
    'rechaza el telefono invalido %s',
    (input) => {
      const saveSpy = vi.fn();
      component.save.subscribe(saveSpy);
      fillValidForm(input);

      component.submit();

      expect(saveSpy).not.toHaveBeenCalled();
      expect(component.form.controls.telefono.hasError('telefonoEcuador')).toBe(
        true,
      );
    },
  );

  function fillValidForm(telefono: string): void {
    component.form.setValue({
      nombres: 'Cliente',
      apellidos: 'Prueba',
      identificacion: '1726494899',
      email: 'cliente@example.com',
      telefono,
      direccion: 'El Inca',
      estado: true,
    });
  }
});
