import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { timeout } from 'rxjs';

import { PagoPayload, PagoResponse, PagosResponse } from '../../features/pagos/models/pago.model';

@Injectable({
  providedIn: 'root',
})
export class PagoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3000/pagos'
      : 'https://backsistemacobros.byronrm.com/pagos';

  findAll() {
    return this.http.get<PagosResponse>(this.apiUrl).pipe(timeout(15000));
  }

  create(payload: PagoPayload) {
    return this.http.post<PagoResponse>(this.apiUrl, payload).pipe(timeout(15000));
  }
}
