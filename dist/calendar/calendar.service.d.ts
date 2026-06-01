import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { TasksService } from '../tasks/tasks.service';
import { RegisterCalendarDto } from './dto/register-calendar.dto';
import { DocumentParserService } from '../common/document-parser.service';
export declare class CalendarService {
    private readonly userRepo;
    private readonly tasksService;
    private readonly configService;
    private readonly documentParser;
    private readonly logger;
    private readonly logFilePath;
    constructor(userRepo: Repository<User>, tasksService: TasksService, configService: ConfigService, documentParser: DocumentParserService);
    private appendLog;
    private isAttendanceTask;
    registerCalendar(userId: string, dto: RegisterCalendarDto): Promise<{
        message: string;
        calendarUrl: string;
    }>;
    syncCalendar(userId: string): Promise<{
        message: string;
        newTasks: number;
    }>;
    processCalendarData(url: string, userId: string): Promise<void>;
}
