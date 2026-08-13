import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { timeout } from 'rxjs';

import { GestionCobranzaResponse } from '../../features/cobros/models/cobro.model';

@Injectable({
  providedIn: 'root',
})
export class CobroService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3000/cuotas'
      : 'https://backsistemacobros.byronrm.com/cuotas';

  findGestionCobranza() {
    return this.http
      .get<GestionCobranzaResponse>(`${this.apiUrl}/gestion-cobranza`)
      .pipe(timeout(15000));
  }
}
