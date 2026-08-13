import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly storageKey = 'cobros_theme_mode';
  private readonly document = inject(DOCUMENT);
  private readonly mode = signal<ThemeMode>(this.loadStoredTheme());

  readonly currentMode = this.mode.asReadonly();
  readonly isDarkMode = computed(() => this.mode() === 'dark');

  constructor() {
    effect(() => {
      const mode = this.mode();
      const body = this.document.body;

      body.classList.toggle('theme-dark', mode === 'dark');
      body.classList.toggle('theme-light', mode === 'light');
      localStorage.setItem(this.storageKey, mode);
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  toggleMode(): void {
    this.mode.update((mode) => (mode === 'dark' ? 'light' : 'dark'));
  }

  private loadStoredTheme(): ThemeMode {
    if (typeof localStorage === 'undefined') {
      return 'light';
    }

    const storedTheme = localStorage.getItem(this.storageKey);

    return storedTheme === 'dark' ? 'dark' : 'light';
  }
}
