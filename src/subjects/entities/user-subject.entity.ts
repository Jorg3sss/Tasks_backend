import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  Unique,
  CreateDateColumn,
} from 'typeorm';
import { User }    from '../../users/entities/user.entity';
import { Subject } from './subject.entity';

/**
 * Tabla de unión que registra qué asignaturas tiene cada alumno.
 * Un alumno puede tener muchas asignaturas; una asignatura puede pertenecer a muchos alumnos.
 */
@Entity('user_subjects')
@Unique(['userId', 'subjectId'])   // evita duplicados por usuario+materia
export class UserSubject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.userSubjects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => Subject, (subject) => subject.userSubjects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;

  @Column({ type: 'uuid' })
  subjectId: string;

  @CreateDateColumn()
  assignedAt: Date;
}
