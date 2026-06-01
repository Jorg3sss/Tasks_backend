import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { Task }        from '../../tasks/entities/task.entity';
import { UserSubject } from './user-subject.entity';

/**
 * Catálogo global de asignaturas.
 * No pertenece a un usuario específico — es compartido entre todos.
 * La relación usuario↔asignatura se gestiona en UserSubject.
 */
@Entity('subjects')
export class Subject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nombre original con mayúsculas/tildes tal como lo aporta el calendario o el usuario. */
  @Column({ type: 'varchar', length: 160 })
  name: string;

  /** Versión normalizada (trim + lower) usada para deduplicación. */
  @Column({ type: 'varchar', length: 160, unique: true })
  normalizedName: string;

  @OneToMany(() => UserSubject, (us) => us.subject)
  userSubjects: UserSubject[];

  @OneToMany(() => Task, (task) => task.subject)
  tasks: Task[];
}
