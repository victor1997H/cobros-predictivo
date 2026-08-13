import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { timeout } from 'rxjs';

import { GestionesCobranzaResponse } from '../../features/cobros/models/gestion-cobranza.model';

@Injectable({
  providedIn: 'root',
})
export class GestionCobranzaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3000/gestiones-cobranza'
      : 'https://backsistemacobros.byronrm.com/gestiones-cobranza';

  findAll() {
    return this.http.get<GestionesCobranzaResponse>(this.apiUrl).pipe(timeout(15000));
  }
}
