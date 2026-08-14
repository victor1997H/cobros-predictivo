import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';

import {
  CuotaPayload,
  CuotaResponse,
  CuotasResponse,
  DeleteCuotaResponse,
} from '../../features/cuotas/models/cuota.model';

@Injectable({
  providedIn: 'root',
})
export class CuotaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3000/cuotas'
      : 'https://backsistemacobros.byronrm.com/cuotas';

  findAll(): Observable<CuotasResponse> {
    return this.http.get<CuotasResponse>(this.apiUrl).pipe(timeout(15000));
  }

  create(data: CuotaPayload): Observable<CuotaResponse> {
    return this.http
      .post<CuotaResponse>(this.apiUrl, data)
      .pipe(timeout(15000));
  }

  update(id: number, data: CuotaPayload): Observable<CuotaResponse> {
    return this.http
      .patch<CuotaResponse>(`${this.apiUrl}/${id}`, data)
      .pipe(timeout(15000));
  }

  delete(id: number): Observable<DeleteCuotaResponse> {
    return this.http
      .delete<DeleteCuotaResponse>(`${this.apiUrl}/${id}`)
      .pipe(timeout(15000));
  }
}
