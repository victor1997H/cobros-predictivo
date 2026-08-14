import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';

import {
  DeletePrestamoResponse,
  PrestamoPayload,
  PrestamoResponse,
  PrestamosResponse,
} from '../../features/prestamos/models/prestamo.model';

@Injectable({
  providedIn: 'root',
})
export class PrestamoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3000/prestamos'
      : 'https://backsistemacobros.byronrm.com/prestamos';

  findAll(): Observable<PrestamosResponse> {
    return this.http.get<PrestamosResponse>(this.apiUrl).pipe(timeout(15000));
  }

  create(data: PrestamoPayload): Observable<PrestamoResponse> {
    return this.http
      .post<PrestamoResponse>(this.apiUrl, data)
      .pipe(timeout(15000));
  }

  update(id: number, data: PrestamoPayload): Observable<PrestamoResponse> {
    return this.http
      .patch<PrestamoResponse>(`${this.apiUrl}/${id}`, data)
      .pipe(timeout(15000));
  }

  delete(id: number): Observable<DeletePrestamoResponse> {
    return this.http
      .delete<DeletePrestamoResponse>(`${this.apiUrl}/${id}`)
      .pipe(timeout(15000));
  }
}
