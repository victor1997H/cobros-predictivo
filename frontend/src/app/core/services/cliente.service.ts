import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';

import {
  ClientePayload,
  ClienteResponse,
  ClientesResponse,
  DeleteClienteResponse,
} from '../../features/clientes/models/cliente.model';

@Injectable({
  providedIn: 'root',
})
export class ClienteService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3000/clientes'
      : 'https://backsistemacobros.byronrm.com/clientes';

  findAll(): Observable<ClientesResponse> {
    return this.http.get<ClientesResponse>(this.apiUrl).pipe(timeout(15000));
  }

  create(data: ClientePayload): Observable<ClienteResponse> {
    return this.http
      .post<ClienteResponse>(this.apiUrl, data)
      .pipe(timeout(15000));
  }

  update(id: number, data: ClientePayload): Observable<ClienteResponse> {
    return this.http
      .patch<ClienteResponse>(`${this.apiUrl}/${id}`, data)
      .pipe(timeout(15000));
  }

  delete(id: number): Observable<DeleteClienteResponse> {
    return this.http
      .delete<DeleteClienteResponse>(`${this.apiUrl}/${id}`)
      .pipe(timeout(15000));
  }
}
