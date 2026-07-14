import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 120 })
  nombres!: string;

  @Column({ length: 120 })
  apellidos!: string;

  @Column({ length: 30, unique: true })
  identificacion!: string;

  @Column({ length: 160, unique: true })
  email!: string;

  @Column({ length: 30 })
  telefono!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  direccion!: string | null;

  @Column({ default: true })
  estado!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
