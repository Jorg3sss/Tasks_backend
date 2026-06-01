import { TasksService } from './tasks.service';
import { GetTasksFilterDto } from './dto/get-tasks-filter.dto';
import { AiSolutionDto } from './dto/ai-solution.dto';
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    findAll(userId: string, filters: GetTasksFilterDto): Promise<import("./entities/task.entity").Task[]>;
    findOne(taskId: string): Promise<import("./entities/task.entity").Task>;
    requestSolution(taskId: string, userId: string): Promise<{
        queued: boolean;
    }>;
    receiveAiSolution(taskId: string, dto: AiSolutionDto): Promise<import("./entities/solution.entity").Solution>;
}
