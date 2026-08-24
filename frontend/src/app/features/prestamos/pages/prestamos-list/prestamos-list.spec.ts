import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ClienteService } from '../../../../core/services/cliente.service';
import { PrestamoService } from '../../../../core/services/prestamo.service';
import { Cliente } from '../../../clientes/models/cliente.model';
import { Prestamo } from '../../models/prestamo.model';
import { PrestamosList } from './prestamos-list';

describe('PrestamosList', () => {
  let component: PrestamosList;
  let fixture: ComponentFixture<PrestamosList>;

  const cliente: Cliente = {
    id: 1,
    nombres: 'Cliente',
    apellidos: 'Prueba',
    identificacion: 'TEST-001',
    email: 'cliente@example.com',
    telefono: '0999999999',
    direccion: null,
    estado: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const prestamoBloqueado: Prestamo = {
    id: 10,
    clienteId: cliente.id,
    cliente,
    monto: '1000.00',
    fechaInicio: '2026-01-01',
    numeroCuotas: 2,
    estado: 'ACTIVO',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    tieneCuotasGeneradas: true,
    tienePagosRegistrados: false,
    puedeEditarCondicionesFinancieras: false,
    motivoBloqueoEdicion:
      'El prestamo ya tiene cuotas generadas. Las condiciones financieras no pueden modificarse.',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrestamosList],
      providers: [
        {
          provide: ClienteService,
          useValue: {
            findAll: () =>
              of({
                success: true,
                message: 'Clientes obtenidos correctamente',
                clientes: [cliente],
              }),
          },
        },
        {
          provide: PrestamoService,
          useValue: {
            findAll: () =>
              of({
                success: true,
                message: 'Prestamos obtenidos correctamente',
                prestamos: [prestamoBloqueado],
              }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrestamosList);
    component = fixture.componentInstance;
  });

  it('deshabilita campos financieros al editar un prestamo con cuotas generadas', () => {
    component.editPrestamo(prestamoBloqueado);

    expect(component.form.controls.clienteId.disabled).toBe(true);
    expect(component.form.controls.monto.disabled).toBe(true);
    expect(component.form.controls.fechaInicio.disabled).toBe(true);
    expect(component.form.controls.numeroCuotas.disabled).toBe(true);
    expect(component.form.controls.estado.enabled).toBe(true);
    expect(component.financialEditionLockMessage()).toBe(
      prestamoBloqueado.motivoBloqueoEdicion,
    );
  });
});
