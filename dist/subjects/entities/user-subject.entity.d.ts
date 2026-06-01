import { User } from '../../users/entities/user.entity';
import { Subject } from './subject.entity';
export declare class UserSubject {
    id: string;
    user: User;
    userId: string;
    subject: Subject;
    subjectId: string;
    assignedAt: Date;
}
