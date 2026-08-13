export type PagoMetodo = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEPOSITO' | 'TARJETA';

export interface PagoPayload {
  cuotaId: number;
  monto: number;
  fechaPago?: string;
  metodoPago?: PagoMetodo;
  referencia?: string | null;
  observacion?: string | null;
}

export interface PagoDetalle {
  pago: {
    id: number;
    fechaPago: string;
    monto: number;
    metodoPago: PagoMetodo;
    referencia: string | null;
    observacion: string | null;
    createdAt: string;
  };
  cuota: {
    id: number;
    numeroCuota: number;
    fechaVencimiento: string;
    monto: number;
    saldoPendiente: number;
    estado: string;
  };
  prestamo: {
    id: number;
    monto: number;
    fechaInicio: string;
    numeroCuotas: number;
    estado: string;
  };
  cliente: {
    id: number;
    identificacion: string;
    nombres: string;
    apellidos: string;
    email: string;
    telefono: string;
  };
}

export interface PagosResponse {
  success: boolean;
  message: string;
  pagos: PagoDetalle[];
}

export interface PagoResponse {
  success: boolean;
  message: string;
  pago: PagoDetalle;
}
