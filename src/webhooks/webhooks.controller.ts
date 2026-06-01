import {
  Controller, Post, Param, Body,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { N8nWebhookGuard }     from './guards/n8n-webhook.guard';
import { WebhookSolutionDto }  from './dto/webhook-solution.dto';
import { TasksService }        from '../tasks/tasks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * POST /webhooks/n8n/task-solution/:taskId
   *
   * Endpoint que n8n llama cuando Gemini termina de procesar una tarea.
   * Flujo completo:
   *   1. Valida el secret (N8nWebhookGuard)
   *   2. Busca la tarea
   *   3. Asigna/crea la asignatura
   *   4. Genera el PDF
   *   5. Guarda la SolutionEntity
   *   6. Envía el correo de notificación
   *
   * Header requerido: x-webhook-secret: <N8N_SECRET_KEY>
   * Body: WebhookSolutionDto
   */
  @UseGuards(N8nWebhookGuard)
  @Post('n8n/task-solution/:taskId')
  @HttpCode(HttpStatus.CREATED)
  receiveN8nCallback(
    @Param('taskId') taskId: string,
    @Body() dto: WebhookSolutionDto,
  ) {
    return this.tasksService.processAiCallback(taskId, dto);
  }
}
