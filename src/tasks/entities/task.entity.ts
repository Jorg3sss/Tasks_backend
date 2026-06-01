import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User }       from '../../users/entities/user.entity';
import { Subject }    from '../../subjects/entities/subject.entity';
import { Solution }   from './solution.entity';
import { TaskType }   from './task-type.enum';
import { TaskStatus } from './task-status.enum';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UID del evento .ics para evitar duplicados en re-sincronizaciones. */
  @Column({ type: 'varchar', unique: true, nullable: true, default: null })
  externalEventId: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  @Column({ type: 'date' })
  assignedDate: Date;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'enum', enum: TaskType, default: TaskType.OTHER })
  type: TaskType;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.PENDING })
  status: TaskStatus;

  // ── Relaciones ─────────────────────────────────────────────────────

  /** nullable: true — si Gemini no puede deducir la materia se deja en null */
  @ManyToOne(() => Subject, (subject) => subject.tasks, {
    eager:     true,
    nullable:  true,
    onDelete:  'SET NULL',
  })
  @JoinColumn({ name: 'subjectId' })
  subject: Subject | null;

  @Column({ type: 'uuid', nullable: true, default: null })
  subjectId: string | null;

  @ManyToOne(() => User, (user) => user.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  /** Solución IA; null hasta que n8n la entregue. */
  @OneToOne(() => Solution, (solution) => solution.task, {
    eager:    true,
    cascade:  true,
    nullable: true,
  })
  solution: Solution | null;

  @CreateDateColumn()
  createdAt: Date;
}
