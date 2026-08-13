import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Cuota } from '../../cuotas/entities/cuota.entity';
import {
  CanalNotificacion,
  EstadoNotificacion,
  ResultadoNotificacion,
} from '../../notificaciones/notificaciones.service';

export const GESTION_ESTADOS_ENVIO = [
  'ENVIADO',
  'PARCIAL',
  'ERROR',
  'NO_CONFIGURADO',
] as const;
export type GestionEstadoEnvio = (typeof GESTION_ESTADOS_ENVIO)[number];

@Entity('gestiones_cobranza')
export class GestionCobranza {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'clave_gestion', length: 220 })
  claveGestion!: string;

  @Column({ name: 'cuota_id' })
  cuotaId!: number;

  @ManyToOne(() => Cuota, (cuota) => cuota.gestionesCobranza, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'cuota_id' })
  cuota!: Cuota;

  @Column({ name: 'fecha_gestion', type: 'date' })
  fechaGestion!: string;

  @Column({ name: 'tipo_gestion', length: 40 })
  tipoGestion!: string;

  @Column({ name: 'dias_atraso', type: 'int', default: 0 })
  diasAtraso!: number;

  @Column({ name: 'nivel_riesgo', length: 30 })
  nivelRiesgo!: string;

  @Column({ length: 30 })
  prioridad!: string;

  @Column({ length: 180 })
  accion!: string;

  @Column({ type: 'text' })
  mensaje!: string;

  @Column({ length: 40, default: 'Produccion' })
  modo!: string;

  @Column({ name: 'cliente_nombre', length: 240 })
  clienteNombre!: string;

  @Column({ name: 'cliente_email', length: 180 })
  clienteEmail!: string;

  @Column({ name: 'cliente_telefono', length: 40 })
  clienteTelefono!: string;

  @Column({ name: 'canales_solicitados', type: 'jsonb' })
  canalesSolicitados!: CanalNotificacion[];

  @Column({ name: 'estado_envio', length: 30 })
  estadoEnvio!: GestionEstadoEnvio;

  @Column({ name: 'resultado_envio', type: 'jsonb', nullable: true })
  resultadoEnvio!: ResultadoNotificacion[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
