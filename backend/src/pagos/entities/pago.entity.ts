import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Cuota } from '../../cuotas/entities/cuota.entity';

export const PAGO_METODOS = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'DEPOSITO',
  'TARJETA',
] as const;
export type PagoMetodo = (typeof PAGO_METODOS)[number];

@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'cuota_id' })
  cuotaId!: number;

  @ManyToOne(() => Cuota, (cuota) => cuota.pagos, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'cuota_id' })
  cuota!: Cuota;

  @Column({ name: 'fecha_pago', type: 'date' })
  fechaPago!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  monto!: number;

  @Column({ name: 'metodo_pago', length: 40, default: 'EFECTIVO' })
  metodoPago!: PagoMetodo;

  @Column({ type: 'varchar', length: 120, nullable: true })
  referencia!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  observacion!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
