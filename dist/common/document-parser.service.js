"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DocumentParserService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentParserService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
let DocumentParserService = DocumentParserService_1 = class DocumentParserService {
    constructor() {
        this.logger = new common_1.Logger(DocumentParserService_1.name);
    }
    async enrichDescription(description) {
        if (!description)
            return description;
        this.logger.log(`[DocumentParser] Descripción original (${description.length} chars): ${description.substring(0, 200)}...`);
        const urlRegex = /https?:\/\/[^\s<>"]+\.(pdf|docx)(\?[^\s<>"]*)?/gi;
        const urls = description.match(urlRegex);
        if (!urls || urls.length === 0) {
            this.logger.log('[DocumentParser] No se encontraron URLs de PDF/DOCX en la descripción');
            return description;
        }
        this.logger.log(`[DocumentParser] URLs encontradas: ${JSON.stringify(urls)}`);
        let enriched = description;
        for (const url of urls) {
            try {
                const ext = url.toLowerCase().includes('.docx') ? 'docx' : 'pdf';
                this.logger.log(`[DocumentParser] Descargando ${ext}: ${url}`);
                const text = await this.downloadAndParse(url, ext);
                if (text?.trim()) {
                    enriched += `\n\n--- Contenido del archivo ${ext.toUpperCase()} (${url}) ---\n${text.trim()}\n--- Fin del archivo ---`;
                    this.logger.log(`[DocumentParser] Documento parseado: ${url} (${text.length} caracteres)`);
                    this.logger.log(`[DocumentParser] Extracto del contenido: ${text.substring(0, 300)}...`);
                }
                else {
                    this.logger.warn(`[DocumentParser] Documento vacío: ${url}`);
                }
            }
            catch (err) {
                this.logger.warn(`[DocumentParser] No se pudo parsear documento ${url}: ${err.message}`);
                this.logger.warn(`[DocumentParser] Stack: ${err.stack}`);
            }
        }
        this.logger.log(`[DocumentParser] Descripción enriquecida (${enriched.length} chars)`);
        return enriched;
    }
    async downloadAndParse(url, type) {
        const response = await axios_1.default.get(url, {
            responseType: 'arraybuffer',
            timeout: 30_000,
            maxRedirects: 5,
        });
        const buffer = Buffer.from(response.data);
        if (type === 'pdf') {
            return this.parsePdf(buffer);
        }
        else {
            return this.parseDocx(buffer);
        }
    }
    async parsePdf(buffer) {
        try {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            return data.text;
        }
        catch (err) {
            this.logger.warn(`Error parseando PDF: ${err.message}`);
            return '';
        }
    }
    async parseDocx(buffer) {
        try {
            const mammoth = await Promise.resolve().then(() => require('mammoth'));
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        }
        catch (err) {
            this.logger.warn(`Error parseando DOCX: ${err.message}`);
            return '';
        }
    }
};
exports.DocumentParserService = DocumentParserService;
exports.DocumentParserService = DocumentParserService = DocumentParserService_1 = __decorate([
    (0, common_1.Injectable)()
], DocumentParserService);
//# sourceMappingURL=document-parser.service.js.map