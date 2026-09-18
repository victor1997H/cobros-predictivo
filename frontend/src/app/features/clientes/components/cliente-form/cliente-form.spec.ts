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

  it('acepta una identificacion numerica de 10 digitos', () => {
    fillValidForm('0987545679', '1726494899');

    expect(component.form.controls.identificacion.valid).toBe(true);
  });

  it.each(['172649489', '17264948991', '17264A4899', '17264-4899', 'abcdefghij'])(
    'rechaza la identificacion invalida %s',
    (identificacion) => {
      const saveSpy = vi.fn();
      component.save.subscribe(saveSpy);
      fillValidForm('0987545679', identificacion);

      component.submit();

      expect(saveSpy).not.toHaveBeenCalled();
      expect(component.form.controls.identificacion.invalid).toBe(true);
    },
  );

  it('mantiene solo numeros en la identificacion ingresada', () => {
    component.form.controls.identificacion.setValue('17264-4899A');

    component.sanitizeIdentificacion();

    expect(component.form.controls.identificacion.value).toBe('172644899');
  });

  function fillValidForm(
    telefono: string,
    identificacion = '1726494899',
  ): void {
    component.form.setValue({
      nombres: 'Cliente',
      apellidos: 'Prueba',
      identificacion,
      email: 'cliente@example.com',
      telefono,
      direccion: 'El Inca',
      estado: true,
    });
  }
});
