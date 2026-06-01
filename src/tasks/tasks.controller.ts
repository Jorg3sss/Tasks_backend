import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TasksService }       from './tasks.service';
import { GetTasksFilterDto }  from './dto/get-tasks-filter.dto';
import { AiSolutionDto }      from './dto/ai-solution.dto';
import { JwtAuthGuard }       from '../auth/guards/jwt-auth.guard';
import { WebhookApiKeyGuard } from '../common/guards/webhook-api-key.guard';
import { GetUser }            from '../common/decorators/get-user.decorator';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * GET /tasks
   * Lista las tareas del usuario autenticado con filtros opcionales.
   * Query params: status, type, subjectId, from (YYYY-MM-DD), to (YYYY-MM-DD)
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @GetUser('sub') userId: string,
    @Query() filters: GetTasksFilterDto,
  ) {
    return this.tasksService.findAllByUser(userId, filters);
  }

  /**
   * GET /tasks/:id
   * Detalle de una tarea (incluye subject + solution).
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') taskId: string) {
    return this.tasksService.findById(taskId);
  }

  /**
   * POST /tasks/:id/request-solution
   * El usuario pide manualmente que se genere la solución IA de una tarea
   * (útil para tareas OVERDUE o SUBMITTED que el scheduler omite).
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/request-solution')
  @HttpCode(HttpStatus.ACCEPTED)
  requestSolution(
    @Param('id') taskId: string,
    @GetUser('sub') userId: string,
  ) {
    return this.tasksService.requestSolution(taskId, userId);
  }

  /**
   * POST /tasks/:id/ai-solution
   * Endpoint legacy — mantenido por compatibilidad.
   */
  @UseGuards(WebhookApiKeyGuard)
  @Post(':id/ai-solution')
  @HttpCode(HttpStatus.CREATED)
  receiveAiSolution(
    @Param('id') taskId: string,
    @Body() dto: AiSolutionDto,
  ) {
    return this.tasksService.processAiCallback(taskId, {
      content:     dto.content,
      subjectName: 'DESCONOCIDA',
      taskType:    'OTHER' as any,
      userEmail:   '',
    });
  }
}
