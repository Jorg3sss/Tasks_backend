import { CalendarService } from './calendar.service';
import { RegisterCalendarDto } from './dto/register-calendar.dto';
export declare class CalendarController {
    private readonly calendarService;
    constructor(calendarService: CalendarService);
    registerCalendar(userId: string, dto: RegisterCalendarDto): Promise<{
        message: string;
        calendarUrl: string;
    }>;
    syncCalendar(userId: string): Promise<{
        message: string;
        newTasks: number;
    }>;
}
