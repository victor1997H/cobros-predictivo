import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

interface CalendarDay {
  value: string;
  label: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

@Component({
  selector: 'app-selector-fecha',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectorFechaComponent),
      multi: true,
    },
  ],
  templateUrl: './selector-fecha.html',
  styleUrl: './selector-fecha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorFechaComponent implements ControlValueAccessor {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  private readonly todayValue = this.formatInternalDate(new Date());
  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  @Input() label = 'Fecha';
  @Input() placeholder = 'dd/mm/aaaa';
  @Input() required = false;
  @Input() showError = false;
  @Input() errorMessage = 'Ingresa una fecha valida.';

  readonly value = signal<string | null>(null);
  readonly isOpen = signal(false);
  readonly isDisabled = signal(false);
  readonly visibleYear = signal(new Date().getFullYear());
  readonly visibleMonth = signal(new Date().getMonth());

  get displayValue(): string {
    const value = this.value();

    if (!value) {
      return '';
    }

    const [year, month, day] = value.split('-');

    return `${day}/${month}/${year}`;
  }

  get currentMonthLabel(): string {
    return `${this.monthNames[this.visibleMonth()]} ${this.visibleYear()}`;
  }

  get calendarDays(): CalendarDay[] {
    const year = this.visibleYear();
    const month = this.visibleMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + index,
      );
      const internalValue = this.formatInternalDate(day);

      return {
        value: internalValue,
        label: day.getDate(),
        isCurrentMonth: day.getMonth() === month,
        isToday: internalValue === this.todayValue,
        isSelected: internalValue === this.value(),
      };
    });
  }

  writeValue(value: string | null): void {
    const normalizedValue = this.normalizeValue(value);

    this.value.set(normalizedValue);

    if (normalizedValue) {
      this.moveCalendarTo(normalizedValue);
    }
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);

    if (isDisabled) {
      this.isOpen.set(false);
    }
  }

  toggleCalendar(): void {
    if (this.isDisabled()) {
      return;
    }

    if (!this.isOpen() && this.value()) {
      this.moveCalendarTo(this.value()!);
    }

    this.isOpen.update((isOpen) => !isOpen);
    this.onTouched();
  }

  closeCalendar(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.onTouched();
    }
  }

  selectDate(value: string): void {
    this.value.set(value);
    this.moveCalendarTo(value);
    this.onChange(value);
    this.onTouched();
    this.isOpen.set(false);
  }

  moveMonth(delta: number): void {
    const date = new Date(this.visibleYear(), this.visibleMonth() + delta, 1);

    this.visibleYear.set(date.getFullYear());
    this.visibleMonth.set(date.getMonth());
  }

  moveYear(delta: number): void {
    this.visibleYear.update((year) => year + delta);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeCalendar();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeCalendar();
  }

  private moveCalendarTo(value: string): void {
    const [year, month] = value.split('-').map((part) => Number(part));

    if (Number.isFinite(year) && Number.isFinite(month)) {
      this.visibleYear.set(year);
      this.visibleMonth.set(month - 1);
    }
  }

  private normalizeValue(value: string | null): string | null {
    if (!value) {
      return null;
    }

    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  }

  private formatInternalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
