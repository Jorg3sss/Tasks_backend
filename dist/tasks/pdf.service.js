"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PdfService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfService = void 0;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const pdf_lib_1 = require("pdf-lib");
const PDFDocumentKit = require('pdfkit');
let PdfService = PdfService_1 = class PdfService {
    constructor() {
        this.logger = new common_1.Logger(PdfService_1.name);
    }
    async generateSolutionPdf(taskTitle, content, taskId, taskType = 'OTHER', cover, customCoverPath) {
        const outputDir = (0, path_1.join)(process.cwd(), 'public', 'uploads', 'pdfs');
        const filename = `solucion-${taskId}.pdf`;
        const outputPath = (0, path_1.join)(outputDir, filename);
        const publicPath = `/uploads/pdfs/${filename}`;
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        if (customCoverPath) {
            await this.generateWithCustomCover(customCoverPath, taskTitle, content, taskType, cover, outputPath);
        }
        else {
            await this.generateWithBuiltinCover(taskTitle, content, taskType, cover, outputPath);
        }
        this.logger.log(`PDF: ${publicPath}`);
        return publicPath;
    }
    generateWithBuiltinCover(taskTitle, content, taskType, cover, outputPath) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocumentKit({ margin: 60, size: 'LETTER', autoFirstPage: false });
            const stream = (0, fs_1.createWriteStream)(outputPath);
            doc.pipe(stream);
            doc.addPage();
            this.renderCover(doc, taskTitle, taskType, cover);
            doc.addPage();
            this.renderContent(doc, taskTitle, content);
            doc.end();
            stream.on('finish', () => resolve());
            stream.on('error', (e) => { this.logger.error(e.message); reject(new common_1.InternalServerErrorException('No se pudo generar el PDF.')); });
        });
    }
    async generateWithCustomCover(customCoverPath, taskTitle, content, taskType, cover, outputPath) {
        const contentPdfPath = outputPath + '.content.tmp.pdf';
        await new Promise((resolve, reject) => {
            const doc = new PDFDocumentKit({ margin: 60, size: 'LETTER' });
            const stream = (0, fs_1.createWriteStream)(contentPdfPath);
            doc.pipe(stream);
            this.renderContent(doc, taskTitle, content);
            doc.end();
            stream.on('finish', () => resolve());
            stream.on('error', (e) => reject(e));
        });
        const [coverBytes, contentBytes] = await Promise.all([
            (0, promises_1.readFile)(customCoverPath),
            (0, promises_1.readFile)(contentPdfPath),
        ]);
        const mergedPdf = await pdf_lib_1.PDFDocument.create();
        const coverDoc = await pdf_lib_1.PDFDocument.load(coverBytes);
        const contentDoc = await pdf_lib_1.PDFDocument.load(contentBytes);
        const coverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices());
        coverPages.forEach(p => mergedPdf.addPage(p));
        const contentPages = await mergedPdf.copyPages(contentDoc, contentDoc.getPageIndices());
        contentPages.forEach(p => mergedPdf.addPage(p));
        const mergedBytes = await mergedPdf.save();
        const fs = await Promise.resolve().then(() => require('fs/promises'));
        await fs.writeFile(outputPath, mergedBytes);
        await fs.unlink(contentPdfPath).catch(() => { });
    }
    renderCover(doc, title, type, cover) {
        const pageH = doc.page.height;
        const pageW = doc.page.width;
        const cx = pageW / 2;
        const bannerH = Math.round(pageH * 0.05);
        doc.rect(0, 0, pageW, bannerH).fill('#1e3a5f');
        doc.rect(0, pageH - bannerH, pageW, bannerH).fill('#1e3a5f');
        const institution = cover?.licenciatura
            ? 'Instituto Tecnológico Superior'
            : 'Institución Educativa';
        doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold')
            .text(institution, 0, bannerH / 2 - 6, { align: 'center', width: pageW });
        doc.rect(0, bannerH, pageW, 3).fill('#c9a84c');
        doc.rect(0, pageH - bannerH - 3, pageW, 3).fill('#c9a84c');
        const startY = bannerH + 40;
        const typeLabels = {
            ESSAY: 'ENSAYO', CODE_SNIPPET: 'PROYECTO DE PROGRAMACIÓN',
            UML_DIAGRAM: 'DIAGRAMA UML', PRESENTATION: 'PRESENTACIÓN',
            READING: 'LECTURA / RESUMEN', EXAM: 'EXAMEN', OTHER: 'TAREA',
        };
        const typeLabel = typeLabels[type] ?? 'TAREA';
        doc.fontSize(9).fillColor('#c9a84c').font('Helvetica-Bold')
            .text(typeLabel, 0, startY, { align: 'center', width: pageW, characterSpacing: 2 });
        const lineY = startY + 22;
        doc.moveTo(cx - 60, lineY).lineTo(cx + 60, lineY)
            .strokeColor('#c9a84c').lineWidth(1.5).stroke();
        doc.fontSize(20).fillColor('#1e3a5f').font('Helvetica-Bold')
            .text(title, 60, lineY + 16, {
            align: 'center',
            width: pageW - 120,
            lineGap: 4,
        });
        if (cover) {
            const dataStartY = doc.y + 36;
            const boxPad = 30;
            const boxX = 80;
            const boxW = pageW - 160;
            const boxH = 180;
            doc.roundedRect(boxX, dataStartY - 12, boxW, boxH, 6)
                .fillAndStroke('#f0f4fa', '#d0daea');
            doc.fontSize(22).fillColor('#1e3a5f').font('Helvetica-Bold')
                .text(cover.studentName, boxX + boxPad, dataStartY + 8, {
                align: 'center',
                width: boxW - boxPad * 2,
            });
            doc.moveDown(0.5);
            const sepY = doc.y;
            doc.moveTo(boxX + boxPad, sepY).lineTo(boxX + boxW - boxPad, sepY)
                .strokeColor('#c9a84c').lineWidth(1).stroke();
            doc.moveDown(0.8);
            const colW = (boxW - boxPad * 2) / 2;
            const col1X = boxX + boxPad;
            const col2X = col1X + colW;
            const rowH = 28;
            let rowY = doc.y;
            const field = (label, value, x, y) => {
                doc.fontSize(8).fillColor('#6b7280').font('Helvetica-Bold')
                    .text(label.toUpperCase(), x, y, { width: colW - 10, characterSpacing: 0.5 });
                doc.fontSize(12).fillColor('#1e3a5f').font('Helvetica-Bold')
                    .text(value || '—', x, y + 11, { width: colW - 10, lineBreak: false });
            };
            field('Materia', cover.subject, col1X, rowY);
            field('Carrera', cover.licenciatura, col2X, rowY);
            rowY += rowH;
            field('Semestre', cover.semestre, col1X, rowY);
            if (cover.dueDate) {
                field('Fecha de entrega', cover.dueDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }), col2X, rowY);
            }
        }
        if (cover?.correo) {
            doc.fontSize(9).fillColor('#9ca3af').font('Helvetica')
                .text(cover.correo, 60, pageH - bannerH - 30, { align: 'center', width: pageW - 120 });
        }
    }
    renderContent(doc, title, content) {
        const pageW = doc.page.width;
        doc.fontSize(18).fillColor('#1e3a5f').font('Helvetica-Bold')
            .text(title, 60, 60, { width: pageW - 120 }).moveDown(0.4);
        doc.moveTo(60, doc.y).lineTo(pageW - 60, doc.y)
            .strokeColor('#c9a84c').lineWidth(2).stroke().moveDown(1);
        const lines = content.split('\n');
        let inCodeBlock = false;
        let codeLang = '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('```')) {
                if (!inCodeBlock) {
                    inCodeBlock = true;
                    codeLang = trimmed.slice(3).split(/\s/)[0];
                    doc.moveDown(0.4);
                    doc.rect(60, doc.y, pageW - 120, 18).fill('#1e3a5f');
                    doc.fontSize(8).fillColor('#c9a84c').font('Helvetica-Bold')
                        .text(`  ${codeLang || 'código'}`, 62, doc.y + 5, { width: pageW - 128 });
                    doc.moveDown(0.3);
                }
                else {
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
            }
            else if (trimmed.startsWith('## ')) {
                doc.fontSize(14).fillColor('#1e3a5f').font('Helvetica-Bold')
                    .text(trimmed.replace(/^## /, '')).moveDown(0.3);
            }
            else if (trimmed.startsWith('# ')) {
                doc.fontSize(16).fillColor('#1e3a5f').font('Helvetica-Bold')
                    .text(trimmed.replace(/^# /, '')).moveDown(0.4);
            }
            else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                doc.fontSize(11).fillColor('#374151').font('Helvetica')
                    .text(`  • ${trimmed.replace(/^[-*] /, '')}`, { lineGap: 2 });
            }
            else if (/^\d+\. /.test(trimmed)) {
                doc.fontSize(11).fillColor('#374151').font('Helvetica')
                    .text(`  ${trimmed}`, { lineGap: 2 });
            }
            else if (trimmed === '') {
                doc.moveDown(0.4);
            }
            else if (/^\*\*(.+)\*\*$/.test(trimmed)) {
                doc.fontSize(11).fillColor('#1e3a5f').font('Helvetica-Bold')
                    .text(trimmed.replace(/\*\*/g, ''), { lineGap: 3 });
            }
            else {
                const cleaned = trimmed.replace(/\*\*([^*]+)\*\*/g, '$1');
                doc.fontSize(11).fillColor('#374151').font('Helvetica')
                    .text(cleaned, { align: 'justify', lineGap: 3 });
            }
        }
    }
};
exports.PdfService = PdfService;
exports.PdfService = PdfService = PdfService_1 = __decorate([
    (0, common_1.Injectable)()
], PdfService);
//# sourceMappingURL=pdf.service.js.map