import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
export declare class SubjectsController {
    private readonly subjectsService;
    constructor(subjectsService: SubjectsService);
    findAll(userId: string): Promise<import("./entities/subject.entity").Subject[]>;
    create(userId: string, dto: CreateSubjectDto): Promise<import("./entities/subject.entity").Subject>;
    remove(userId: string, subjectId: string): Promise<void>;
}
