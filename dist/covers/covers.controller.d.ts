import { CoversService } from './covers.service';
export declare class CoversController {
    private readonly coversService;
    constructor(coversService: CoversService);
    getCover(userId: string): Promise<import("./entities/cover-page.entity").CoverPage>;
    uploadCover(userId: string, file: Express.Multer.File): Promise<import("./entities/cover-page.entity").CoverPage>;
    generateCover(userId: string): Promise<import("./entities/cover-page.entity").CoverPage>;
    deleteCover(userId: string): Promise<void>;
}
