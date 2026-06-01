import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserSubject } from '../../subjects/entities/user-subject.entity';
import { Task }        from '../../tasks/entities/task.entity';
import { CoverPage }   from '../../covers/entities/cover-page.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  nombres: string;

  @Column({ type: 'varchar', length: 80 })
  apellidoPaterno: string;

  @Column({ type: 'varchar', length: 80 })
  apellidoMaterno: string;

  @Column({ type: 'varchar', length: 20 })
  semestre: string;

  @Column({ type: 'varchar', length: 120 })
  licenciatura: string;

  @Column({ type: 'varchar', unique: true })
  correo: string;

  @Column({ type: 'varchar' })
  password: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  calendarUrl: string | null;

  /** Materias asignadas al alumno (vía tabla user_subjects). */
  @OneToMany(() => UserSubject, (us) => us.user, { cascade: true })
  userSubjects: UserSubject[];

  @OneToMany(() => Task, (task) => task.user, { cascade: true })
  tasks: Task[];

  /** Portadas del usuario (la más reciente es la activa). */
  @OneToMany(() => CoverPage, (cover) => cover.user, { cascade: true })
  coverPages: CoverPage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
