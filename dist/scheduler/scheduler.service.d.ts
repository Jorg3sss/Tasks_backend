import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Task } from '../tasks/entities/task.entity';
import { TasksService } from '../tasks/tasks.service';
import { DocumentParserService } from '../common/document-parser.service';
export declare class SchedulerService implements OnModuleInit {
    private readonly taskRepo;
    private readonly configService;
    private readonly documentParser;
    private readonly tasksService;
    private readonly logger;
    constructor(taskRepo: Repository<Task>, configService: ConfigService, documentParser: DocumentParserService, tasksService: TasksService);
    onModuleInit(): void;
    retryPendingAiSolutions(): Promise<void>;
}
