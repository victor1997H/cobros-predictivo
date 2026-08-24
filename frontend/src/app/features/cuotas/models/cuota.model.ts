import type { Prestamo } from '../../prestamos/models/prestamo.model';

export type CuotaEstado = 'PENDIENTE' | 'PAGADA' | 'VENCIDA';

export interface Cuota {
  id: number;
  prestamoId: number;
  prestamo: Prestamo;
  numeroCuota: number;
  fechaVencimiento: string;
  monto: string;
  saldoPendiente: string;
  estado: CuotaEstado;
  createdAt: string;
  updatedAt: string;
}

export interface CuotaPayload {
  prestamoId: number;
  numeroCuota: number;
  fechaVencimiento: string;
  monto: number;
  saldoPendiente: number;
  estado?: CuotaEstado;
}

export interface CuotasResponse {
  success: boolean;
  message: string;
  cuotas: Cuota[];
}

export interface CuotaPendientePago {
  cuotaId: number;
  prestamoId: number;
  cliente: {
    id: number;
    identificacion: string;
    nombres: string;
    apellidos: string;
    email: string;
    telefono: string;
  };
  numeroCuota: number;
  fechaVencimiento: string;
  montoCuota: number;
  saldoPendiente: number;
  estado: CuotaEstado;
  totalPagadoCuota: number;
  saldoPendientePrestamo: number;
}

export interface CuotasPendientesPagoResponse {
  success: boolean;
  message: string;
  cuotas: CuotaPendientePago[];
}

export interface CuotaResponse {
  success: boolean;
  message: string;
  cuota: Cuota;
}

export interface DeleteCuotaResponse {
  success: boolean;
  message: string;
}
