import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CuotasPendientesPagoResponse } from '../../features/cuotas/models/cuota.model';
import { CuotaService } from './cuota.service';

describe('CuotaService', () => {
  let service: CuotaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CuotaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('consulta cuotas pendientes para pago desde el endpoint independiente', () => {
    const response: CuotasPendientesPagoResponse = {
      success: true,
      message: 'Cuotas pendientes para pago obtenidas correctamente',
      cuotas: [
        {
          cuotaId: 1,
          prestamoId: 10,
          cliente: {
            id: 1,
            identificacion: 'TEST-001',
            nombres: 'Cliente',
            apellidos: 'Prueba',
            email: 'cliente@example.com',
            telefono: '0999999999',
          },
          numeroCuota: 1,
          fechaVencimiento: '2026-12-31',
          montoCuota: 500,
          saldoPendiente: 500,
          estado: 'PENDIENTE',
          totalPagadoCuota: 0,
          saldoPendientePrestamo: 500,
        },
      ],
    };

    service.findPendientesParaPago().subscribe((result) => {
      expect(result).toEqual(response);
    });

    const request = httpMock.expectOne(
      'http://localhost:3000/cuotas/pendientes-para-pago',
    );

    expect(request.request.method).toBe('GET');

    request.flush(response);
  });
});
