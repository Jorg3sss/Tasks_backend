import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { join }    from 'path';
import { mkdir, readFile }   from 'fs/promises';
import { createWriteStream } from 'fs';
import { PDFDocument } from 'pdf-lib';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocumentKit = require('pdfkit');

export interface CoverData {
  studentName: string;
  subject:     string;
  semestre:    string;
  licenciatura: string;
  dueDate?:    Date;
  correo?:     string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generateSolutionPdf(
    taskTitle: string,
    content:   string,
    taskId:    string,
    taskType:  string = 'OTHER',
    cover?:    CoverData,
    customCoverPath?: string,
  ): Promise<string> {
    const outputDir  = join(process.cwd(), 'public', 'uploads', 'pdfs');
    const filename   = `solucion-${taskId}.pdf`;
    const outputPath = join(outputDir, filename);
    const publicPath = `/uploads/pdfs/${filename}`;

    await mkdir(outputDir, { recursive: true });

    if (customCoverPath) {
      // Usar portada personalizada: generar contenido y mergear
      await this.generateWithCustomCover(customCoverPath, taskTitle, content, taskType, cover, outputPath);
    } else {
      // Generar portada + contenido con PDFKit
      await this.generateWithBuiltinCover(taskTitle, content, taskType, cover, outputPath);
    }

    this.logger.log(`PDF: ${publicPath}`);
    return publicPath;
  }

  private generateWithBuiltinCover(
    taskTitle: string,
    content: string,
    taskType: string,
    cover: CoverData | undefined,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc    = new PDFDocumentKit({ margin: 60, size: 'LETTER', autoFirstPage: false });
      const stream = createWriteStream(outputPath);
      doc.pipe(stream);

      // Portada
      doc.addPage();
      this.renderCover(doc, taskTitle, taskType, cover);

      // Contenido
      doc.addPage();
      this.renderContent(doc, taskTitle, content);

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error',  (e) => { this.logger.error(e.message); reject(new InternalServerErrorException('No se pudo generar el PDF.')); });
    });
  }

  private async generateWithCustomCover(
    customCoverPath: string,
    taskTitle: string,
    content: string,
    taskType: string,
    cover: CoverData | undefined,
    outputPath: string,
  ): Promise<void> {
    // 1. Generar PDF de contenido (sin portada) con PDFKit
    const contentPdfPath = outputPath + '.content.tmp.pdf';
    await new Promise<void>((resolve, reject) => {
      const doc    = new PDFDocumentKit({ margin: 60, size: 'LETTER' });
      const stream = createWriteStream(contentPdfPath);
      doc.pipe(stream);
      this.renderContent(doc, taskTitle, content);
      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error',  (e) => reject(e));
    });

    // 2. Leer ambos PDFs y mergear con pdf-lib
    const [coverBytes, contentBytes] = await Promise.all([
      readFile(customCoverPath),
      readFile(contentPdfPath),
    ]);

    const mergedPdf = await PDFDocument.create();
    const coverDoc = await PDFDocument.load(coverBytes);
    const contentDoc = await PDFDocument.load(contentBytes);

    const coverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices());
    coverPages.forEach(p => mergedPdf.addPage(p));

    const contentPages = await mergedPdf.copyPages(contentDoc, contentDoc.getPageIndices());
    contentPages.forEach(p => mergedPdf.addPage(p));

    const mergedBytes = await mergedPdf.save();
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, mergedBytes);

    // Limpiar archivo temporal
    await fs.unlink(contentPdfPath).catch(() => {});
  }

  // ── Portada ───────────────────────────────────────────────────────

  private renderCover(doc: PDFKit.PDFDocument, title: string, type: string, cover?: CoverData) {
    const pageH = doc.page.height;
    const pageW = doc.page.width;
    const cx    = pageW / 2;

    // Franja superior sólida (5% de la página)
    const bannerH = Math.round(pageH * 0.05);
    doc.rect(0, 0, pageW, bannerH).fill('#1e3a5f');

    // Franja inferior sólida
    doc.rect(0, pageH - bannerH, pageW, bannerH).fill('#1e3a5f');

    // Nombre de la institución dentro de la franja superior (blanco)
    const institution = cover?.licenciatura
      ? 'Instituto Tecnológico Superior'
      : 'Institución Educativa';
    doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold')
      .text(institution, 0, bannerH / 2 - 6, { align: 'center', width: pageW });

    // Línea dorada bajo la franja superior
    doc.rect(0, bannerH, pageW, 3).fill('#c9a84c');

    // Línea dorada sobre la franja inferior
    doc.rect(0, pageH - bannerH - 3, pageW, 3).fill('#c9a84c');

    // ── Bloque central ───────────────────────────────────────────────
    const startY = bannerH + 40;

    // Tipo de tarea
    const typeLabels: Record<string, string> = {
      ESSAY: 'ENSAYO', CODE_SNIPPET: 'PROYECTO DE PROGRAMACIÓN',
      UML_DIAGRAM: 'DIAGRAMA UML', PRESENTATION: 'PRESENTACIÓN',
      READING: 'LECTURA / RESUMEN', EXAM: 'EXAMEN', OTHER: 'TAREA',
    };
    const typeLabel = typeLabels[type] ?? 'TAREA';

    // Etiqueta de tipo (pequeña, centrada)
    doc.fontSize(9).fillColor('#c9a84c').font('Helvetica-Bold')
      .text(typeLabel, 0, startY, { align: 'center', width: pageW, characterSpacing: 2 });

    // Línea decorativa dorada
    const lineY = startY + 22;
    doc.moveTo(cx - 60, lineY).lineTo(cx + 60, lineY)
      .strokeColor('#c9a84c').lineWidth(1.5).stroke();

    // Título de la tarea — grande y prominente
    doc.fontSize(20).fillColor('#1e3a5f').font('Helvetica-Bold')
      .text(title, 60, lineY + 16, {
        align: 'center',
        width: pageW - 120,
        lineGap: 4,
      });

    // ── Datos del alumno ─────────────────────────────────────────────
    if (cover) {
      const dataStartY = doc.y + 36;

      // Caja de datos con borde suave
      const boxPad  = 30;
      const boxX    = 80;
      const boxW    = pageW - 160;
      const boxH    = 180;
      doc.roundedRect(boxX, dataStartY - 12, boxW, boxH, 6)
        .fillAndStroke('#f0f4fa', '#d0daea');

      // Nombre del alumno — muy grande
      doc.fontSize(22).fillColor('#1e3a5f').font('Helvetica-Bold')
        .text(cover.studentName, boxX + boxPad, dataStartY + 8, {
          align: 'center',
          width: boxW - boxPad * 2,
        });

      doc.moveDown(0.5);

      // Línea separadora dentro de la caja
      const sepY = doc.y;
      doc.moveTo(boxX + boxPad, sepY).lineTo(boxX + boxW - boxPad, sepY)
        .strokeColor('#c9a84c').lineWidth(1).stroke();
      doc.moveDown(0.8);

      // Campos en dos columnas
      const colW    = (boxW - boxPad * 2) / 2;
      const col1X   = boxX + boxPad;
      const col2X   = col1X + colW;
      const rowH    = 28;
      let   rowY    = doc.y;

      const field = (label: string, value: string, x: number, y: number) => {
        doc.fontSize(8).fillColor('#6b7280').font('Helvetica-Bold')
          .text(label.toUpperCase(), x, y, { width: colW - 10, characterSpacing: 0.5 });
        doc.fontSize(12).fillColor('#1e3a5f').font('Helvetica-Bold')
          .text(value || '—', x, y + 11, { width: colW - 10, lineBreak: false });
      };

      field('Materia',   cover.subject,      col1X, rowY);
      field('Carrera',   cover.licenciatura, col2X, rowY);
      rowY += rowH;
      field('Semestre',  cover.semestre,     col1X, rowY);
      if (cover.dueDate) {
        field('Fecha de entrega',
          cover.dueDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }),
          col2X, rowY);
      }
    }

    // Correo centrado abajo (discreto)
    if (cover?.correo) {
      doc.fontSize(9).fillColor('#9ca3af').font('Helvetica')
        .text(cover.correo, 60, pageH - bannerH - 30, { align: 'center', width: pageW - 120 });
    }
  }

  // ── Contenido ─────────────────────────────────────────────────────

  private renderContent(doc: PDFKit.PDFDocument, title: string, content: string) {
    const pageW = doc.page.width;

    // Título de la sección
    doc.fontSize(18).fillColor('#1e3a5f').font('Helvetica-Bold')
      .text(title, 60, 60, { width: pageW - 120 }).moveDown(0.4);

    doc.moveTo(60, doc.y).lineTo(pageW - 60, doc.y)
      .strokeColor('#c9a84c').lineWidth(2).stroke().moveDown(1);

    // Renderizar Markdown
    const lines = content.split('\n');
    let inCodeBlock = false;
    let codeLang    = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLang    = trimmed.slice(3).split(/\s/)[0];
          doc.moveDown(0.4);
          doc.rect(60, doc.y, pageW - 120, 18).fill('#1e3a5f');
          doc.fontSize(8).fillColor('#c9a84c').font('Helvetica-Bold')
            .text(`  ${codeLang || 'código'}`, 62, doc.y + 5, { width: pageW - 128 });
          doc.moveDown(0.3);
        } else {
          inCodeBlock = false;
          doc.moveDown(0.4);
        }
        continue;
      }

      if (inCodeBlock) {
        const textH = 14;
        doc.rect(60, doc.y, pageW - 120, textH).fill('#1e1e1e');
        doc.fontSize(9).fillColor('#d4d4d4').font('Courier')
          .text(`  ${line}`, 60, doc.y + 2, { width: pageW - 124, lineBreak: false });
        doc.moveDown(0.95);
        continue;
      }

      if (trimmed.startsWith('### ')) {
        doc.fontSize(12).fillColor('#374151').font('Helvetica-Bold')
          .text(trimmed.replace(/^### /, '')).moveDown(0.3);
      } else if (trimmed.startsWith('## ')) {
        doc.fontSize(14).fillColor('#1e3a5f').font('Helvetica-Bold')
          .text(trimmed.replace(/^## /, '')).moveDown(0.3);
      } else if (trimmed.startsWith('# ')) {
        doc.fontSize(16).fillColor('#1e3a5f').font('Helvetica-Bold')
          .text(trimmed.replace(/^# /, '')).moveDown(0.4);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        doc.fontSize(11).fillColor('#374151').font('Helvetica')
          .text(`  • ${trimmed.replace(/^[-*] /, '')}`, { lineGap: 2 });
      } else if (/^\d+\. /.test(trimmed)) {
        doc.fontSize(11).fillColor('#374151').font('Helvetica')
          .text(`  ${trimmed}`, { lineGap: 2 });
      } else if (trimmed === '') {
        doc.moveDown(0.4);
      } else if (/^\*\*(.+)\*\*$/.test(trimmed)) {
        doc.fontSize(11).fillColor('#1e3a5f').font('Helvetica-Bold')
          .text(trimmed.replace(/\*\*/g, ''), { lineGap: 3 });
      } else {
        // Inline bold: reemplazar **texto** dentro de párrafos
        const cleaned = trimmed.replace(/\*\*([^*]+)\*\*/g, '$1');
        doc.fontSize(11).fillColor('#374151').font('Helvetica')
          .text(cleaned, { align: 'justify', lineGap: 3 });
      }
    }
  }
}
