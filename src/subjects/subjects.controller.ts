import {
  Controller, Get, Post, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { SubjectsService }    from './subjects.service';
import { CreateSubjectDto }   from './dto/create-subject.dto';
import { JwtAuthGuard }       from '../auth/guards/jwt-auth.guard';
import { GetUser }            from '../common/decorators/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  /** GET /subjects — lista las materias del usuario autenticado */
  @Get()
  findAll(@GetUser('sub') userId: string) {
    return this.subjectsService.findAllByUser(userId);
  }

  /** POST /subjects — crea una materia manualmente */
  @Post()
  create(
    @GetUser('sub') userId: string,
    @Body() dto: CreateSubjectDto,
  ) {
    return this.subjectsService.create(userId, dto.name);
  }

  /** DELETE /subjects/:id — elimina una materia del usuario */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @GetUser('sub') userId: string,
    @Param('id') subjectId: string,
  ) {
    return this.subjectsService.remove(userId, subjectId);
  }
}
