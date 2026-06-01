import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { join } from 'path';
import { mkdir, unlink } from 'fs/promises';
import { createWriteStream } from 'fs';
import { CoverPage } from './entities/cover-page.entity';
import { User } from '../users/entities/user.entity';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

@Injectable()
export class CoversService {
  private readonly logger = new Logger(CoversService.name);

  constructor(
    @InjectRepository(CoverPage)
    private readonly coverRepo: Repository<CoverPage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findByUser(userId: string): Promise<CoverPage | null> {
    return this.coverRepo.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async uploadCover(userId: string, file: Express.Multer.File): Promise<CoverPage> {
    const outputDir = join(process.cwd(), 'public', 'uploads', 'covers');
    await mkdir(outputDir, { recursive: true });

    const filename = `cover-${userId}-${Date.now()}.pdf`;
    const outputPath = join(outputDir, filename);
    const publicPath = `/uploads/covers/${filename}`;

    // Mover el archivo subido
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, file.buffer);

    // Eliminar portada anterior si existe
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

  async generateAiCover(userId: string): Promise<CoverPage> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const outputDir = join(process.cwd(), 'public', 'uploads', 'covers');
    await mkdir(outputDir, { recursive: true });

    const filename = `cover-ai-${userId}-${Date.now()}.pdf`;
    const outputPath = join(outputDir, filename);
    const publicPath = `/uploads/covers/${filename}`;

    await this.generateCoverPdf(outputPath, {
      studentName: `${user.nombres} ${user.apellidoPaterno} ${user.apellidoMaterno}`.trim(),
      semestre: user.semestre ?? '',
      licenciatura: user.licenciatura ?? '',
      correo: user.correo,
    });

    // Eliminar portada anterior si existe
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

  async deleteCover(userId: string): Promise<void> {
    await this.deleteExistingCover(userId);
  }

  private async deleteExistingCover(userId: string): Promise<void> {
    const existing = await this.coverRepo.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
    if (existing) {
      try {
        const fullPath = join(process.cwd(), 'public', existing.pdfUrl);
        await unlink(fullPath).catch(() => {});
      } catch {
        // Ignorar si el archivo no existe
      }
      await this.coverRepo.remove(existing);
    }
  }

  private generateCoverPdf(
    outputPath: string,
    data: {
      studentName: string;
      semestre: string;
      licenciatura: string;
      correo: string;
    },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 60, size: 'LETTER', autoFirstPage: false });
      const stream = createWriteStream(outputPath);
      doc.pipe(stream);

      const pageH = doc.page.height;
      const pageW = doc.page.width;
      const cx = pageW / 2;

      doc.addPage();

      // Franja superior
      const bannerH = Math.round(pageH * 0.05);
      doc.rect(0, 0, pageW, bannerH).fill('#1e3a5f');
      doc.rect(0, pageH - bannerH, pageW, bannerH).fill('#1e3a5f');

      // Institución
      const institution = data.licenciatura
        ? 'Instituto Tecnológico Superior'
        : 'Institución Educativa';
      doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold')
        .text(institution, 0, bannerH / 2 - 6, { align: 'center', width: pageW });

      // Líneas doradas
      doc.rect(0, bannerH, pageW, 3).fill('#c9a84c');
      doc.rect(0, pageH - bannerH - 3, pageW, 3).fill('#c9a84c');

      // Bloque central
      const startY = bannerH + 60;

      doc.fontSize(9).fillColor('#c9a84c').font('Helvetica-Bold')
        .text('PORTADA', 0, startY, { align: 'center', width: pageW, characterSpacing: 3 });

      const lineY = startY + 24;
      doc.moveTo(cx - 60, lineY).lineTo(cx + 60, lineY)
        .strokeColor('#c9a84c').lineWidth(1.5).stroke();

      // Título
      doc.fontSize(24).fillColor('#1e3a5f').font('Helvetica-Bold')
        .text('TAREA ACADÉMICA', 60, lineY + 20, {
          align: 'center',
          width: pageW - 120,
          lineGap: 4,
        });

      // Datos del alumno
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

      const field = (label: string, value: string, x: number, y: number) => {
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
      stream.on('error', (e: Error) => reject(new InternalServerErrorException('No se pudo generar la portada: ' + e.message)));
    });
  }
}
