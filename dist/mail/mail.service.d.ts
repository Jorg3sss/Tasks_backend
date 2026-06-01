import { ConfigService } from '@nestjs/config';
export declare class MailService {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    sendTaskReadyEmail(userEmail: string, taskTitle: string, pdfPublicUrl: string): Promise<void>;
    private buildHtml;
}
