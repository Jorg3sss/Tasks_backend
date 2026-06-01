import { TaskType } from '../../tasks/entities/task-type.enum';
export declare class WebhookSolutionDto {
    content: string;
    subjectName: string;
    taskType: TaskType;
    userEmail?: string;
}
