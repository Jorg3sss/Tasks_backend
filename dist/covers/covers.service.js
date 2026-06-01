"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CoversService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoversService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const path_1 = require("path");
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const cover_page_entity_1 = require("./entities/cover-page.entity");
const user_entity_1 = require("../users/entities/user.entity");
const PDFDocument = require('pdfkit');
let CoversService = CoversService_1 = class CoversService {
    constructor(coverRepo, userRepo) {
        this.coverRepo = coverRepo;
        this.userRepo = userRepo;
        this.logger = new common_1.Logger(CoversService_1.name);
    }
    async findByUser(userId) {
        return this.coverRepo.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
    }
    async uploadCover(userId, file) {
        const outputDir = (0, path_1.join)(process.cwd(), 'public', 'uploads', 'covers');
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        const filename = `cover-${userId}-${Date.now()}.pdf`;
        const outputPath = (0, path_1.join)(outputDir, filename);
        const publicPath = `/uploads/covers/${filename}`;
        const fs = await Promise.resolve().then(() => require('fs/promises'));
        await fs.writeFile(outputPath, file.buffer);
        await this.deleteExistingCover(userId);
        const cover = this.coverRepo.create({
            pdfUrl: publicPath,
            isCustom: true,
            userId,
        });
        const saved = await this.coverRepo.save(cover);
        this.logger.log(`Portada personalizada subida para usuario ${userId}: ${publicPath}`);
        return saved;
    }
    async generateAiCover(userId) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('Usuario no encontrado.');
        const outputDir = (0, path_1.join)(process.cwd(), 'public', 'uploads', 'covers');
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        const filename = `cover-ai-${userId}-${Date.now()}.pdf`;
        const outputPath = (0, path_1.join)(outputDir, filename);
        const publicPath = `/uploads/covers/${filename}`;
        await this.generateCoverPdf(outputPath, {
            studentName: `${user.nombres} ${user.apellidoPaterno} ${user.apellidoMaterno}`.trim(),
            semestre: user.semestre ?? '',
            licenciatura: user.licenciatura ?? '',
            correo: user.correo,
        });
        await this.deleteExistingCover(userId);
        const cover = this.coverRepo.create({
            pdfUrl: publicPath,
            isCustom: false,
            userId,
        });
        const saved = await this.coverRepo.save(cover);
        this.logger.log(`Portada IA generada para usuario ${userId}: ${publicPath}`);
        return saved;
    }
    async deleteCover(userId) {
        await this.deleteExistingCover(userId);
    }
    async deleteExistingCover(userId) {
        const existing = await this.coverRepo.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
        if (existing) {
            try {
                const fullPath = (0, path_1.join)(process.cwd(), 'public', existing.pdfUrl);
                await (0, promises_1.unlink)(fullPath).catch(() => { });
            }
            catch {
            }
            await this.coverRepo.remove(existing);
        }
    }
    generateCoverPdf(outputPath, data) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 60, size: 'LETTER', autoFirstPage: false });
            const stream = (0, fs_1.createWriteStream)(outputPath);
            doc.pipe(stream);
            const pageH = doc.page.height;
            const pageW = doc.page.width;
            const cx = pageW / 2;
            doc.addPage();
            const bannerH = Math.round(pageH * 0.05);
            doc.rect(0, 0, pageW, bannerH).fill('#1e3a5f');
            doc.rect(0, pageH - bannerH, pageW, bannerH).fill('#1e3a5f');
            const institution = data.licenciatura
                ? 'Instituto Tecnológico Superior'
                : 'Institución Educativa';
            doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold')
                .text(institution, 0, bannerH / 2 - 6, { align: 'center', width: pageW });
            doc.rect(0, bannerH, pageW, 3).fill('#c9a84c');
            doc.rect(0, pageH - bannerH - 3, pageW, 3).fill('#c9a84c');
            const startY = bannerH + 60;
            doc.fontSize(9).fillColor('#c9a84c').font('Helvetica-Bold')
                .text('PORTADA', 0, startY, { align: 'center', width: pageW, characterSpacing: 3 });
            const lineY = startY + 24;
            doc.moveTo(cx - 60, lineY).lineTo(cx + 60, lineY)
                .strokeColor('#c9a84c').lineWidth(1.5).stroke();
            doc.fontSize(24).fillColor('#1e3a5f').font('Helvetica-Bold')
                .text('TAREA ACADÉMICA', 60, lineY + 20, {
                align: 'center',
                width: pageW - 120,
                lineGap: 4,
            });
            const dataStartY = doc.y + 40;
            const boxPad = 30;
            const boxX = 80;
            const boxW = pageW - 160;
            const boxH = 160;
            doc.roundedRect(boxX, dataStartY - 12, boxW, boxH, 6)
                .fillAndStroke('#f0f4fa', '#d0daea');
            doc.fontSize(22).fillColor('#1e3a5f').font('Helvetica-Bold')
                .text(data.studentName, boxX + boxPad, dataStartY + 8, {
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
            let rowY = doc.y;
            const field = (label, value, x, y) => {
                doc.fontSize(8).fillColor('#6b7280').font('Helvetica-Bold')
                    .text(label.toUpperCase(), x, y, { width: colW - 10, characterSpacing: 0.5 });
                doc.fontSize(12).fillColor('#1e3a5f').font('Helvetica-Bold')
                    .text(value || '—', x, y + 11, { width: colW - 10, lineBreak: false });
            };
            field('Carrera', data.licenciatura, col1X, rowY);
            field('Semestre', data.semestre, col2X, rowY);
            if (data.correo) {
                doc.fontSize(9).fillColor('#9ca3af').font('Helvetica')
                    .text(data.correo, 60, pageH - bannerH - 30, { align: 'center', width: pageW - 120 });
            }
            doc.end();
            stream.on('finish', () => resolve());
            stream.on('error', (e) => reject(new common_1.InternalServerErrorException('No se pudo generar la portada: ' + e.message)));
        });
    }
};
exports.CoversService = CoversService;
exports.CoversService = CoversService = CoversService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(cover_page_entity_1.CoverPage)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], CoversService);
//# sourceMappingURL=covers.service.js.map