import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 120 })
  nombre!: string;

  @Column({ length: 160, unique: true })
  email!: string;

  @Column({ length: 255, select: false })
  password!: string;

  @Column({
    name: 'reset_password_token_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  resetPasswordTokenHash!: string | null;

  @Column({
    name: 'reset_password_expires_at',
    type: 'timestamp',
    nullable: true,
  })
  resetPasswordExpiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
