import { Repository } from 'typeorm';
import { Subject } from './entities/subject.entity';
import { UserSubject } from './entities/user-subject.entity';
export declare class SubjectsService {
    private readonly subjectRepo;
    private readonly userSubjectRepo;
    constructor(subjectRepo: Repository<Subject>, userSubjectRepo: Repository<UserSubject>);
    findAllByUser(userId: string): Promise<Subject[]>;
    findOrCreate(userId: string, name: string): Promise<Subject>;
    create(userId: string, name: string): Promise<Subject>;
    remove(userId: string, subjectId: string): Promise<void>;
}
