export interface CoverData {
    studentName: string;
    subject: string;
    semestre: string;
    licenciatura: string;
    dueDate?: Date;
    correo?: string;
}
export declare class PdfService {
    private readonly logger;
    generateSolutionPdf(taskTitle: string, content: string, taskId: string, taskType?: string, cover?: CoverData, customCoverPath?: string): Promise<string>;
    private generateWithBuiltinCover;
    private generateWithCustomCover;
    private renderCover;
    private renderContent;
}
