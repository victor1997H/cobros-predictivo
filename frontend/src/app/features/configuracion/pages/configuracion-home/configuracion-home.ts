import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';

import { ClienteService } from '../../../../core/services/cliente.service';
import { CobroService } from '../../../../core/services/cobro.service';
import { GestionCobranzaService } from '../../../../core/services/gestion-cobranza.service';
import { PagoService } from '../../../../core/services/pago.service';
import { ThemeMode, ThemeService } from '../../../../core/services/theme.service';

type EstadoServicio = 'OPERATIVO' | 'ERROR';

interface ServicioSistema {
  nombre: string;
  origen: string;
  estado: EstadoServicio;
  detalle: string;
}

@Component({
  selector: 'app-configuracion-home',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatTableModule],
  templateUrl: './configuracion-home.html',
  styleUrl: './configuracion-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguracionHome implements OnInit {
  private readonly clienteService = inject(ClienteService);
  private readonly cobroService = inject(CobroService);
  private readonly gestionCobranzaService = inject(GestionCobranzaService);
  private readonly pagoService = inject(PagoService);
  private readonly themeService = inject(ThemeService);

  readonly displayedColumns = ['nombre', 'origen', 'estado', 'detalle'];
  readonly servicios = signal<ServicioSistema[]>([]);
  readonly currentTheme = this.themeService.currentMode;
  readonly frontendUrl = signal(window.location.origin);
  readonly backendUrl = signal(
    window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : 'https://backsistemacobros.byronrm.com',
  );
  readonly n8nUrl = signal(
    window.location.hostname === 'localhost'
      ? 'http://localhost:5678'
      : 'https://n8nsistemacobros.byronrm.com',
  );
  readonly isLoading = signal(false);

  readonly serviciosOperativos = computed(
    () => this.servicios().filter((servicio) => servicio.estado === 'OPERATIVO').length,
  );
  readonly serviciosConError = computed(
    () => this.servicios().filter((servicio) => servicio.estado === 'ERROR').length,
  );
  readonly sistemaOperativo = computed(
    () => this.servicios().length > 0 && this.serviciosConError() === 0,
  );

  ngOnInit(): void {
    this.loadEstadoSistema();
  }

  loadEstadoSistema(): void {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);

    forkJoin([
      this.clienteService.findAll().pipe(
        map((response) =>
          this.createSuccess(
            'Clientes',
            'Backend /clientes',
            `${response.clientes.length} clientes cargados`,
          ),
        ),
        catchError(() =>
          of(this.createError('Clientes', 'Backend /clientes', 'No se pudo consultar clientes')),
        ),
      ),
      this.cobroService.findGestionCobranza().pipe(
        map((response) =>
          this.createSuccess(
            'Gesti\u00f3n de cobros y n8n',
            'Backend /cuotas/gestion-cobranza',
            `${response.cuotas.length} cuotas disponibles para automatizaci\u00f3n`,
          ),
        ),
        catchError(() =>
          of(
            this.createError(
              'Gesti\u00f3n de cobros y n8n',
              'Backend /cuotas/gestion-cobranza',
              'No se pudo consultar la gesti\u00f3n de cobros',
            ),
          ),
        ),
      ),
      this.pagoService.findAll().pipe(
        map((response) =>
          this.createSuccess(
            'Pagos',
            'Backend /pagos',
            `${response.pagos.length} pagos registrados`,
          ),
        ),
        catchError(() =>
          of(this.createError('Pagos', 'Backend /pagos', 'No se pudo consultar pagos')),
        ),
      ),
      this.gestionCobranzaService.findAll().pipe(
        map((response) =>
          this.createSuccess(
            'Gestiones registradas por n8n',
            'Backend /gestiones-cobranza',
            `${response.gestiones.length} gestiones guardadas`,
          ),
        ),
        catchError(() =>
          of(
            this.createError(
              'Gestiones registradas por n8n',
              'Backend /gestiones-cobranza',
              'No se pudo consultar el historial de gestiones',
            ),
          ),
        ),
      ),
    ])
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe((servicios) => this.servicios.set(servicios));
  }

  setTheme(mode: ThemeMode): void {
    this.themeService.setMode(mode);
  }

  private createSuccess(nombre: string, origen: string, detalle: string): ServicioSistema {
    return {
      nombre,
      origen,
      detalle,
      estado: 'OPERATIVO',
    };
  }

  private createError(nombre: string, origen: string, detalle: string): ServicioSistema {
    return {
      nombre,
      origen,
      detalle,
      estado: 'ERROR',
    };
  }
}
