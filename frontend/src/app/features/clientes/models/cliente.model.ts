export interface Cliente {
  id: number;
  nombres: string;
  apellidos: string;
  identificacion: string;
  email: string;
  telefono: string;
  direccion: string | null;
  estado: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientePayload {
  nombres: string;
  apellidos: string;
  identificacion: string;
  email: string;
  telefono: string;
  direccion: string | null;
  estado: boolean;
}

export interface ClientesResponse {
  success: boolean;
  message: string;
  clientes: Cliente[];
}

export interface ClienteResponse {
  success: boolean;
  message: string;
  cliente: Cliente;
}

export interface DeleteClienteResponse {
  success: boolean;
  message: string;
}
