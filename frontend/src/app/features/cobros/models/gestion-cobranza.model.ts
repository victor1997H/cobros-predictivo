export type CanalNotificacion = 'CORREO' | 'WHATSAPP';
export type EstadoNotificacion = 'ENVIADO' | 'ERROR' | 'NO_CONFIGURADO';
export type EstadoEnvioGestion = 'ENVIADO' | 'PARCIAL' | 'ERROR' | 'NO_CONFIGURADO';
export type TipoAlertaInterna = 'ALERTA_ALTO' | 'ALERTA_CRITICA';
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

export interface ResultadoNotificacion {
  canal: CanalNotificacion;
  estado: EstadoNotificacion;
  detalle: string;
  proveedor: string;
  fecha: string;
}

export interface AlertaInternaGestion {
  tipo: TipoAlertaInterna;
  prioridad: string;
  mensaje: string;
  accionRecomendada: string;
  requiereIntervencionHumana: boolean;
}

export interface GestionCobranzaRegistro {
  id: number;
  claveGestion: string;
  cuotaId: number;
  fechaGestion: string;
  tipoGestion: string;
  diasAtraso: number;
  categoriaReferencia?: CategoriaReferencia;
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
  alertaInterna?: AlertaInternaGestion | null;
  createdAt: string;
}

export interface GestionesCobranzaResponse {
  success: boolean;
  message: string;
  gestiones: GestionCobranzaRegistro[];
}
