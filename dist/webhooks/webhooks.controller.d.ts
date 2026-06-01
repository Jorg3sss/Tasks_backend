import { WebhookSolutionDto } from './dto/webhook-solution.dto';
import { TasksService } from '../tasks/tasks.service';
export declare class WebhooksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    receiveN8nCallback(taskId: string, dto: WebhookSolutionDto): Promise<import("../tasks/entities/solution.entity").Solution>;
}
