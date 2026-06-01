import { Task } from './task.entity';
export declare class Solution {
    id: string;
    contenidoMarkdown: string;
    pdfUrl: string | null;
    zipUrl: string | null;
    generadoEn: Date;
    task: Task;
    taskId: string;
}
