export declare class ZipService {
    private readonly logger;
    generateZipFromMarkdown(content: string, taskId: string): Promise<string | null>;
    private extractCodeFiles;
    private buildZip;
    private createZipBuffer;
    private toDosTime;
    private crc32;
    private static crc32Table;
}
