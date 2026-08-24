import type { Cliente } from '../../clientes/models/cliente.model';
import type { Cuota } from '../../cuotas/models/cuota.model';

export interface Prestamo {
  id: number;
  clienteId: number;
  cliente: Cliente;
  monto: string;
  fechaInicio: string;
  numeroCuotas: number;
  estado: string;
  createdAt: string;
  updatedAt: string;
  tieneCuotasGeneradas: boolean;
  tienePagosRegistrados: boolean;
  puedeEditarCondicionesFinancieras: boolean;
  motivoBloqueoEdicion: string | null;
}

export interface PrestamoPayload {
  clienteId: number;
  monto: number;
  fechaInicio: string;
  numeroCuotas: number;
  estado?: string;
  generarCuotas?: boolean;
  fechaPrimerVencimiento?: string;
}

export interface PrestamosResponse {
  success: boolean;
  message: string;
  prestamos: Prestamo[];
}

export interface PrestamoResponse {
  success: boolean;
  message: string;
  prestamo: Prestamo;
  cuotasGeneradas?: Cuota[];
}

export interface DeletePrestamoResponse {
  success: boolean;
  message: string;
}
