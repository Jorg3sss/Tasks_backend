import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CoversService } from './covers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('covers')
export class CoversController {
  constructor(private readonly coversService: CoversService) {}

  /**
   * GET /covers
   * Devuelve la portada activa del usuario (o null si no tiene).
   */
  @Get()
  getCover(@GetUser('sub') userId: string) {
    return this.coversService.findByUser(userId);
  }

  /**
   * POST /covers/upload
   * Sube un PDF personalizado como portada.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos PDF.'), false);
      }
    },
  }))
  uploadCover(
    @GetUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.coversService.uploadCover(userId, file);
  }

  /**
   * POST /covers/generate
   * Genera una portada con IA (PDFKit) usando los datos del perfil.
   */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  generateCover(@GetUser('sub') userId: string) {
    return this.coversService.generateAiCover(userId);
  }

  /**
   * DELETE /covers
   * Elimina la portada actual del usuario.
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCover(@GetUser('sub') userId: string) {
    return this.coversService.deleteCover(userId);
  }
}
