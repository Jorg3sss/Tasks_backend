import { UserSubject } from '../../subjects/entities/user-subject.entity';
import { Task } from '../../tasks/entities/task.entity';
import { CoverPage } from '../../covers/entities/cover-page.entity';
export declare class User {
    id: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    semestre: string;
    licenciatura: string;
    correo: string;
    password: string;
    calendarUrl: string | null;
    userSubjects: UserSubject[];
    tasks: Task[];
    coverPages: CoverPage[];
    createdAt: Date;
    updatedAt: Date;
}
