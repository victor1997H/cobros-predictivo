export type NivelRiesgo = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
export type TipoGestion = 'VENCE_MANANA' | 'VENCIDA';
export type CategoriaReferencia =
  | 'PREVENTIVO'
  | 'A1'
  | 'A2'
  | 'A3'
  | 'B1'
  | 'B2'
  | 'C1'
  | 'C2'
  | 'D'
  | 'E';

export interface CuotaGestion {
  id: number;
  numeroCuota: number;
  fechaVencimiento: string;
  monto: number;
  saldoPendiente: number;
  estado: string;
}

export interface PrestamoGestion {
  id: number;
  monto: number;
  fechaInicio: string;
  numeroCuotas: number;
  estado: string;
}

export interface ClienteGestion {
  id: number;
  identificacion: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
}

export interface CobroGestion {
  cuota: CuotaGestion;
  prestamo: PrestamoGestion;
  cliente: ClienteGestion;
  tipoGestion: TipoGestion;
  diasAtraso: number;
  categoriaReferencia?: CategoriaReferencia;
  nivelRiesgo: NivelRiesgo;
}

export interface GestionCobranzaResponse {
  success: boolean;
  message: string;
  fechaReferencia: string;
  fechaManana: string;
  cuotas: CobroGestion[];
}
