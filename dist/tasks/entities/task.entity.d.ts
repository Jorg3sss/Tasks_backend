import { User } from '../../users/entities/user.entity';
import { Subject } from '../../subjects/entities/subject.entity';
import { Solution } from './solution.entity';
import { TaskType } from './task-type.enum';
import { TaskStatus } from './task-status.enum';
export declare class Task {
    id: string;
    externalEventId: string | null;
    title: string;
    description: string | null;
    assignedDate: Date;
    dueDate: Date;
    type: TaskType;
    status: TaskStatus;
    subject: Subject | null;
    subjectId: string | null;
    user: User;
    userId: string;
    solution: Solution | null;
    createdAt: Date;
}
