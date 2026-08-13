export type CanalNotificacion = 'CORREO' | 'WHATSAPP';
export type EstadoNotificacion = 'ENVIADO' | 'ERROR' | 'NO_CONFIGURADO';
export type EstadoEnvioGestion = 'ENVIADO' | 'PARCIAL' | 'ERROR' | 'NO_CONFIGURADO';

export interface ResultadoNotificacion {
  canal: CanalNotificacion;
  estado: EstadoNotificacion;
  detalle: string;
  proveedor: string;
  fecha: string;
}

export interface GestionCobranzaRegistro {
  id: number;
  claveGestion: string;
  cuotaId: number;
  fechaGestion: string;
  tipoGestion: string;
  diasAtraso: number;
  nivelRiesgo: string;
  prioridad: string;
  accion: string;
  mensaje: string;
  modo: string;
  clienteNombre: string;
  clienteEmail: string;
  clienteTelefono: string;
  canalesSolicitados: CanalNotificacion[];
  estadoEnvio: EstadoEnvioGestion;
  resultadoEnvio: ResultadoNotificacion[] | null;
  createdAt: string;
}

export interface GestionesCobranzaResponse {
  success: boolean;
  message: string;
  gestiones: GestionCobranzaRegistro[];
}
