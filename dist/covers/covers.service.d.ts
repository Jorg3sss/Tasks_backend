import { Repository } from 'typeorm';
import { CoverPage } from './entities/cover-page.entity';
import { User } from '../users/entities/user.entity';
export declare class CoversService {
    private readonly coverRepo;
    private readonly userRepo;
    private readonly logger;
    constructor(coverRepo: Repository<CoverPage>, userRepo: Repository<User>);
    findByUser(userId: string): Promise<CoverPage | null>;
    uploadCover(userId: string, file: Express.Multer.File): Promise<CoverPage>;
    generateAiCover(userId: string): Promise<CoverPage>;
    deleteCover(userId: string): Promise<void>;
    private deleteExistingCover;
    private generateCoverPdf;
}
