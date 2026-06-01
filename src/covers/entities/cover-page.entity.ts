import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('cover_pages')
export class CoverPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Ruta pública relativa del PDF. Ej: /uploads/covers/cover-<userId>.pdf */
  @Column({ type: 'varchar' })
  pdfUrl: string;

  /** true = subido por el usuario, false = generado por IA */
  @Column({ type: 'boolean', default: false })
  isCustom: boolean;

  @ManyToOne(() => User, (user) => user.coverPages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
