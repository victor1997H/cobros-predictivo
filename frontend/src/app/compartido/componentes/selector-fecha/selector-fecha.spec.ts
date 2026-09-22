import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectorFechaComponent } from './selector-fecha';

describe('SelectorFechaComponent', () => {
  let component: SelectorFechaComponent;
  let fixture: ComponentFixture<SelectorFechaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectorFechaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectorFechaComponent);
    component = fixture.componentInstance;
  });

  it('muestra una fecha interna YYYY-MM-DD como DD/MM/YYYY', () => {
    component.writeValue('2026-08-13');
    fixture.detectChanges();

    expect(component.displayValue).toBe('13/08/2026');
  });

  it('mantiene el valor interno en formato YYYY-MM-DD al seleccionar fecha', () => {
    let selectedValue: string | null = null;

    component.registerOnChange((value) => {
      selectedValue = value;
    });

    component.selectDate('2026-09-21');

    expect(selectedValue).toBe('2026-09-21');
    expect(component.displayValue).toBe('21/09/2026');
  });

  it('cierra el calendario con Escape', () => {
    component.toggleCalendar();
    expect(component.isOpen()).toBe(true);

    component.onEscape();

    expect(component.isOpen()).toBe(false);
  });

  it('permite navegar entre meses sin cambiar el valor seleccionado', () => {
    component.writeValue('2026-08-13');
    component.moveMonth(1);

    expect(component.value()).toBe('2026-08-13');
    expect(component.visibleMonth()).toBe(8);
  });
});
