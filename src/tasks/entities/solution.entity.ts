import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Task } from './task.entity';

@Entity('solutions')
export class Solution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Respuesta cruda de Gemini/n8n en formato Markdown. */
  @Column({ type: 'text' })
  contenidoMarkdown: string;

  /**
   * Ruta pública relativa del PDF generado.
   * Ej: /uploads/pdfs/solucion-<taskId>.pdf
   * Se sirve a través de ServeStaticModule desde ./public
   */
  @Column({ type: 'varchar', nullable: true, default: null })
  pdfUrl: string | null;

  /** ZIP con archivos de código (solo para taskType CODE_SNIPPET). */
  @Column({ type: 'varchar', nullable: true, default: null })
  zipUrl: string | null;

  @CreateDateColumn()
  generadoEn: Date;

  // ── Relación ──────────────────────────────────────────────────────

  @OneToOne(() => Task, (task) => task.solution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ type: 'uuid' })
  taskId: string;
}
