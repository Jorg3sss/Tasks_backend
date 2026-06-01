import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { join }    from 'path';
import { mkdir, readFile }   from 'fs/promises';
import { createWriteStream } from 'fs';
import { PDFDocument } from 'pdf-lib';
import { PlanoDiapositivasDto, SlideDto } from '../harness/dto/n8n-solution-response.dto';
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
    planoDiapositivas?: PlanoDiapositivasDto | null,
  ): Promise<string> {
    const outputDir  = join(process.cwd(), 'public', 'uploads', 'pdfs');
    const filename   = `solucion-${taskId}.pdf`;
    const outputPath = join(outputDir, filename);
    const publicPath = `/uploads/pdfs/${filename}`;

    await mkdir(outputDir, { recursive: true });

    // Si hay plano de diapositivas, generar PDF con Puppeteer
    if (planoDiapositivas?.slides?.length) {
      await this.generatePresentationPdf(
        planoDiapositivas,
        taskTitle,
        content,
        taskId,
        cover,
        customCoverPath,
        outputPath,
      );
      this.logger.log(`PDF presentación: ${publicPath}`);
      return publicPath;
    }

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

  // ── Motor de Presentaciones con Puppeteer ────────────────────────

  /**
   * Genera un PDF de presentación usando Puppeteer (headless Chrome).
   * Configurado para Docker en VPS: --no-sandbox, --disable-setuid-sandbox.
   * Viewport: 1920x1080 (16:9 panorámico).
   * Usa break-after: page para saltos de página perfectos.
   */
  async generatePresentationPdf(
    plano: PlanoDiapositivasDto,
    taskTitle: string,
    content: string,
    taskId: string,
    cover?: CoverData,
    customCoverPath?: string,
    outputPath?: string,
  ): Promise<Buffer> {
    const output = outputPath ?? join(process.cwd(), 'public', 'uploads', 'pdfs', `solucion-${taskId}.pdf`);

    let puppeteer: any;
    try {
      puppeteer = await import('puppeteer-core');
    } catch {
      throw new InternalServerErrorException(
        'puppeteer-core no está instalado. Ejecuta: npm install puppeteer-core',
      );
    }

    // Buscar ejecutable de Chrome/Chromium
    const executablePath = this.findChromeExecutable();
    if (!executablePath) {
      throw new InternalServerErrorException(
        'No se encontró Chrome/Chromium. Configura CHROME_PATH en .env o instala Chrome.',
      );
    }

    let browser: any = null;
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();

      // Viewport panorámico 16:9
      await page.setViewport({ width: 1920, height: 1080 });

      // Generar HTML dinámico
      const html = this.buildPresentationHtml(plano, taskTitle, cover);

      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Generar PDF con saltos de página
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      // Guardar en disco
      const fs = await import('fs/promises');
      await fs.writeFile(output, pdfBuffer);

      this.logger.log(`Presentación generada: ${plano.slides.length} slides → ${output}`);
      return pdfBuffer;
    } catch (err: any) {
      this.logger.error(`Error generando presentación: ${err.message}`);
      throw new InternalServerErrorException(`Error generando presentación: ${err.message}`);
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  // ── HTML Builder para Presentaciones ─────────────────────────────

  private buildPresentationHtml(
    plano: PlanoDiapositivasDto,
    taskTitle: string,
    cover?: CoverData,
  ): string {
    const isDark = plano.estilo_visual === 'minimal_dark';
    const bgColor = isDark ? '#1a1a2e' : '#ffffff';
    const textColor = isDark ? '#e0e0e0' : '#1e3a5f';
    const accentColor = '#c9a84c';
    const subtitleColor = isDark ? '#a0a0a0' : '#6b7280';
    const slideBg = isDark ? '#16213e' : '#f8fafc';

    const slidesHtml = plano.slides
      .map(slide => this.buildSlideHtml(slide, isDark, bgColor, textColor, accentColor, subtitleColor, slideBg))
      .join('\n');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4 landscape; margin: 0; }
    body {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      background: ${bgColor};
      color: ${textColor};
    }
    .slide {
      width: 100%;
      min-height: 100vh;
      padding: 60px 80px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      break-after: page;
      page-break-after: always;
      position: relative;
      background: ${slideBg};
    }
    .slide:last-child { break-after: auto; page-break-after: auto; }
    .slide-header {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4px;
      background: linear-gradient(90deg, ${accentColor}, ${textColor}, ${accentColor});
    }
    .slide-number {
      position: absolute;
      bottom: 20px;
      right: 40px;
      font-size: 12px;
      color: ${subtitleColor};
    }
    h1 { font-size: 2.5em; margin-bottom: 20px; color: ${textColor}; }
    h2 { font-size: 1.8em; margin-bottom: 16px; color: ${accentColor}; }
    p { font-size: 1.2em; line-height: 1.6; color: ${textColor}; }
    ul { list-style: none; padding: 0; }
    ul li {
      font-size: 1.1em;
      padding: 12px 0;
      border-bottom: 1px solid ${isDark ? '#2a2a4a' : '#e5e7eb'};
      color: ${textColor};
    }
    ul li::before {
      content: '▸';
      color: ${accentColor};
      font-weight: bold;
      margin-right: 12px;
    }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; flex: 1; }
    .col { padding: 20px; }
    .titulo-centrado {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      flex: 1;
    }
    .titulo-centrado h1 { font-size: 3em; }
    .titulo-centrado p { font-size: 1.4em; margin-top: 20px; }
    .speaker-notes {
      margin-top: 20px;
      padding: 12px 16px;
      background: ${isDark ? '#0f3460' : '#eff6ff'};
      border-left: 3px solid ${accentColor};
      font-size: 0.9em;
      color: ${subtitleColor};
      font-style: italic;
    }
  </style>
</head>
<body>
${slidesHtml}
</body>
</html>`;
  }

  private buildSlideHtml(
    slide: SlideDto,
    _isDark: boolean,
    _bgColor: string,
    textColor: string,
    accentColor: string,
    subtitleColor: string,
    _slideBg: string,
  ): string {
    const notesHtml = slide.notas_orador
      ? `<div class="speaker-notes">Notas: ${this.escapeHtml(slide.notas_orador)}</div>`
      : '';

    switch (slide.layout) {
      case 'titulo_centrado':
        return `<div class="slide">
  <div class="slide-header"></div>
  <div class="titulo-centrado">
    <h1>${this.escapeHtml(slide.titulo)}</h1>
    ${slide.contenido.map(c => `<p>${this.escapeHtml(c)}</p>`).join('\n    ')}
  </div>
  <div class="slide-number">${slide.num_slide}</div>
  ${notesHtml}
</div>`;

      case 'dos_columnas':
        const mid = Math.ceil(slide.contenido.length / 2);
        const col1 = slide.contenido.slice(0, mid);
        const col2 = slide.contenido.slice(mid);
        return `<div class="slide">
  <div class="slide-header"></div>
  <h2>${this.escapeHtml(slide.titulo)}</h2>
  <div class="two-col">
    <div class="col">
      ${col1.map(c => `<p style="margin-bottom:16px">${this.escapeHtml(c)}</p>`).join('\n      ')}
    </div>
    <div class="col">
      ${col2.map(c => `<p style="margin-bottom:16px">${this.escapeHtml(c)}</p>`).join('\n      ')}
    </div>
  </div>
  <div class="slide-number">${slide.num_slide}</div>
  ${notesHtml}
</div>`;

      case 'lista_bullets':
      default:
        return `<div class="slide">
  <div class="slide-header"></div>
  <h2>${this.escapeHtml(slide.titulo)}</h2>
  <ul>
    ${slide.contenido.map(c => `<li>${this.escapeHtml(c)}</li>`).join('\n    ')}
  </ul>
  <div class="slide-number">${slide.num_slide}</div>
  ${notesHtml}
</div>`;
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private findChromeExecutable(): string | null {
    // Buscar variable de entorno primero
    const envPath = process.env.CHROME_PATH;
    if (envPath) return envPath;

    // Rutas comunes en Linux (Docker/VPS)
    const linuxPaths = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
    ];

    // Rutas en Windows
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    ];

    const fs = require('fs');
    const allPaths = process.platform === 'win32' ? winPaths : linuxPaths;

    for (const p of allPaths) {
      try {
        if (fs.existsSync(p)) return p;
      } catch {
        continue;
      }
    }

    return null;
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
