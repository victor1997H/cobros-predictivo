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
import { finalize, forkJoin } from 'rxjs';

import { ClienteService } from '../../../../core/services/cliente.service';
import { CobroService } from '../../../../core/services/cobro.service';
import { GestionCobranzaService } from '../../../../core/services/gestion-cobranza.service';
import { PagoService } from '../../../../core/services/pago.service';
import { Cliente } from '../../../clientes/models/cliente.model';
import {
  CategoriaReferencia,
  CobroGestion,
  NivelRiesgo,
} from '../../../cobros/models/cobro.model';
import { GestionCobranzaRegistro } from '../../../cobros/models/gestion-cobranza.model';
import { PagoDetalle } from '../../../pagos/models/pago.model';

interface RiesgoResumen {
  nivel: NivelRiesgo;
  categorias: string;
  cantidad: number;
  saldoPendiente: number;
}

@Component({
  selector: 'app-reportes-home',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatTableModule],
  templateUrl: './reportes-home.html',
  styleUrl: './reportes-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportesHome implements OnInit {
  private readonly clienteService = inject(ClienteService);
  private readonly cobroService = inject(CobroService);
  private readonly gestionCobranzaService = inject(GestionCobranzaService);
  private readonly pagoService = inject(PagoService);

  readonly displayedColumns = ['nivel', 'categorias', 'cantidad', 'saldoPendiente'];
  readonly clientes = signal<Cliente[]>([]);
  readonly cuotasGestion = signal<CobroGestion[]>([]);
  readonly gestionesRegistradas = signal<GestionCobranzaRegistro[]>([]);
  readonly pagos = signal<PagoDetalle[]>([]);
  readonly fechaReferencia = signal('');
  readonly fechaManana = signal('');
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly clientesActivos = computed(
    () => this.clientes().filter((cliente) => cliente.estado).length,
  );
  readonly clientesInactivos = computed(
    () => this.clientes().filter((cliente) => !cliente.estado).length,
  );
  readonly totalGestion = computed(() => this.cuotasGestion().length);
  readonly saldoPendienteGestion = computed(() =>
    this.cuotasGestion().reduce((total, item) => total + item.cuota.saldoPendiente, 0),
  );
  readonly totalRecaudado = computed(() =>
    this.pagos().reduce((total, item) => total + item.pago.monto, 0),
  );
  readonly notificacionesProcesadas = computed(
    () =>
      this.gestionesRegistradas().filter((gestion) =>
        ['ENVIADO', 'PARCIAL'].includes(gestion.estadoEnvio),
      ).length,
  );
  readonly resumenRiesgo = computed<RiesgoResumen[]>(() => {
    const niveles: NivelRiesgo[] = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'];

    return niveles.map((nivel) => {
      const cuotas = this.cuotasGestion().filter((item) => item.nivelRiesgo === nivel);

      return {
        nivel,
        categorias: this.categoriasPorNivel(cuotas),
        cantidad: cuotas.length,
        saldoPendiente: cuotas.reduce((total, item) => total + item.cuota.saldoPendiente, 0),
      };
    });
  });
  readonly ultimasGestiones = computed(() => this.gestionesRegistradas().slice(0, 6));
  readonly gestionesEnviadas = computed(
    () => this.gestionesRegistradas().filter((gestion) => gestion.estadoEnvio === 'ENVIADO').length,
  );
  readonly gestionesParciales = computed(
    () => this.gestionesRegistradas().filter((gestion) => gestion.estadoEnvio === 'PARCIAL').length,
  );
  readonly gestionesConError = computed(
    () => this.gestionesRegistradas().filter((gestion) => gestion.estadoEnvio === 'ERROR').length,
  );
  readonly alertasInternas = computed(
    () => this.gestionesRegistradas().filter((gestion) => gestion.alertaInterna).length,
  );
  readonly intervencionesHumanas = computed(
    () =>
      this.gestionesRegistradas().filter(
        (gestion) => gestion.alertaInterna?.requiereIntervencionHumana,
      ).length,
  );

  ngOnInit(): void {
    this.loadReportes();
  }

  loadReportes(): void {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    forkJoin({
      clientes: this.clienteService.findAll(),
      gestion: this.cobroService.findGestionCobranza(),
      gestionesRegistradas: this.gestionCobranzaService.findAll(),
      pagos: this.pagoService.findAll(),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ clientes, gestion, gestionesRegistradas, pagos }) => {
          this.clientes.set(clientes.clientes);
          this.cuotasGestion.set(gestion.cuotas);
          this.gestionesRegistradas.set(gestionesRegistradas.gestiones);
          this.pagos.set(pagos.pagos);
          this.fechaReferencia.set(gestion.fechaReferencia);
          this.fechaManana.set(gestion.fechaManana);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.resolveErrorMessage(error));
        },
      });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  alertaOperadorLabel(gestion: GestionCobranzaRegistro): string {
    if (!gestion.alertaInterna) {
      return '';
    }

    return gestion.alertaInterna.requiereIntervencionHumana
      ? 'Atencion inmediata'
      : 'Seguimiento prioritario';
  }

  categoriaGestionLabel(gestion: GestionCobranzaRegistro): string {
    return this.categoriaReferenciaLabel(gestion.categoriaReferencia);
  }

  private categoriasPorNivel(cuotas: CobroGestion[]): string {
    if (cuotas.length === 0) {
      return 'Sin cuotas';
    }

    return Array.from(
      new Set(
        cuotas.map((item) =>
          this.categoriaReferenciaLabel(item.categoriaReferencia),
        ),
      ),
    ).join(', ');
  }

  private categoriaReferenciaLabel(
    categoriaReferencia?: CategoriaReferencia,
  ): string {
    if (!categoriaReferencia) {
      return 'Sin categoria';
    }

    return categoriaReferencia === 'PREVENTIVO'
      ? 'Preventivo'
      : `Categoria ${categoriaReferencia}`;
  }

  private resolveErrorMessage(error: unknown): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'TimeoutError'
    ) {
      return 'La solicitud tard\u00f3 demasiado. Verifica la conexi\u00f3n e intenta nuevamente.';
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

    return 'No se pudo cargar el reporte.';
  }
}
