import { Task } from '../../tasks/entities/task.entity';
import { UserSubject } from './user-subject.entity';
export declare class Subject {
    id: string;
    name: string;
    normalizedName: string;
    userSubjects: UserSubject[];
    tasks: Task[];
}
