import { TaskStatus } from '../entities/task-status.enum';
import { TaskType } from '../entities/task-type.enum';
export declare class GetTasksFilterDto {
    status?: TaskStatus;
    type?: TaskType;
    subjectId?: string;
    from?: string;
    to?: string;
}
