export declare class DocumentParserService {
    private readonly logger;
    enrichDescription(description: string): Promise<string>;
    private downloadAndParse;
    private parsePdf;
    private parseDocx;
}
