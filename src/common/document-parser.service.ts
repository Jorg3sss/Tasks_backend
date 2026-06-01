import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  /**
   * Detecta URLs de PDF/DOCX en la descripción de una tarea,
   * descarga los archivos y extrae su texto.
   * Devuelve la descripción enriquecida con el contenido de los documentos.
   */
  async enrichDescription(description: string): Promise<string> {
    if (!description) return description;

    this.logger.log(`[DocumentParser] Descripción original (${description.length} chars): ${description.substring(0, 200)}...`);

    // Buscar URLs que terminen en .pdf o .docx
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
        } else {
          this.logger.warn(`[DocumentParser] Documento vacío: ${url}`);
        }
      } catch (err: any) {
        this.logger.warn(`[DocumentParser] No se pudo parsear documento ${url}: ${err.message}`);
        this.logger.warn(`[DocumentParser] Stack: ${err.stack}`);
      }
    }

    this.logger.log(`[DocumentParser] Descripción enriquecida (${enriched.length} chars)`);
    return enriched;
  }

  private async downloadAndParse(url: string, type: 'pdf' | 'docx'): Promise<string> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      maxRedirects: 5,
    });

    const buffer = Buffer.from(response.data);

    if (type === 'pdf') {
      return this.parsePdf(buffer);
    } else {
      return this.parseDocx(buffer);
    }
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text;
    } catch (err: any) {
      this.logger.warn(`Error parseando PDF: ${err.message}`);
      return '';
    }
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (err: any) {
      this.logger.warn(`Error parseando DOCX: ${err.message}`);
      return '';
    }
  }
}
