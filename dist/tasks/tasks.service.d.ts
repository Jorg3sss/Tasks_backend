import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { Solution } from './entities/solution.entity';
import { GetTasksFilterDto } from './dto/get-tasks-filter.dto';
import { PdfService } from './pdf.service';
import { ZipService } from './zip.service';
import { SubjectsService } from '../subjects/subjects.service';
import { MailService } from '../mail/mail.service';
import { WebhookSolutionDto } from '../webhooks/dto/webhook-solution.dto';
import { ConfigService } from '@nestjs/config';
import { CoversService } from '../covers/covers.service';
import { DocumentParserService } from '../common/document-parser.service';
export declare class TasksService {
    private readonly taskRepo;
    private readonly solutionRepo;
    private readonly pdfService;
    private readonly zipService;
    private readonly subjectsService;
    private readonly mailService;
    private readonly configService;
    private readonly coversService;
    private readonly documentParser;
    private readonly logger;
    constructor(taskRepo: Repository<Task>, solutionRepo: Repository<Solution>, pdfService: PdfService, zipService: ZipService, subjectsService: SubjectsService, mailService: MailService, configService: ConfigService, coversService: CoversService, documentParser: DocumentParserService);
    countByUser(userId: string): Promise<number>;
    findAllByUser(userId: string, filters: GetTasksFilterDto): Promise<Task[]>;
    findById(taskId: string): Promise<Task>;
    processAiCallback(taskId: string, payload: WebhookSolutionDto): Promise<Solution>;
    requestSolution(taskId: string, userId: string): Promise<{
        queued: boolean;
    }>;
    createFromCalendar(data: {
        userId: string;
        subjectName?: string | null;
        externalEventId: string;
        title: string;
        description?: string;
        assignedDate: Date;
        dueDate: Date;
        type?: string;
    }): Promise<Task>;
}
