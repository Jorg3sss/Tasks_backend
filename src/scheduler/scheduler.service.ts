import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import { ConfigService }     from '@nestjs/config';
import axios                 from 'axios';
import { Task }              from '../tasks/entities/task.entity';
import { TaskStatus }        from '../tasks/entities/task-status.enum';
import { TasksService }      from '../tasks/tasks.service';
import { DocumentParserService } from '../common/document-parser.service';

const RETRY_INTERVAL_MS = 10 * 60 * 1000; // cada 10 minutos
const INITIAL_DELAY_MS  = 45_000;          // 45 s después del arranque
const MAX_BATCH         = 1;               // 1 tarea por ciclo — evita saturar quota
const DELAY_BETWEEN_MS  = 5_000;          // 5 s entre llamadas (<15 req/min de Gemini)

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly configService: ConfigService,
    private readonly documentParser: DocumentParserService,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
  ) {}

  onModuleInit() {
    // Primera ejecución tras el arranque
    setTimeout(() => this.retryPendingAiSolutions(), INITIAL_DELAY_MS);
    // Ejecuciones periódicas
    setInterval(() => this.retryPendingAiSolutions(), RETRY_INTERVAL_MS);
  }

  async retryPendingAiSolutions(): Promise<void> {
    const n8nUrl = this.configService.get<string>('N8N_WEBHOOK_URL');
    if (!n8nUrl) return;

    // Solo tareas PENDING sin solución — OVERDUE/SUBMITTED se generan manualmente
    // Excluir PROCESSING para evitar colisiones con el scheduler
    const tasks = await this.taskRepo
      .createQueryBuilder('task')
      .leftJoin('task.solution', 'solution')
      .leftJoinAndSelect('task.subject', 'subject')
      .where('solution.id IS NULL')
      .andWhere('task.status = :status', { status: 'PENDING' })
      .take(MAX_BATCH)
      .getMany();

    if (tasks.length === 0) {
      this.logger.debug('Scheduler: sin tareas pendientes de IA');
      return;
    }

    this.logger.log(`Scheduler: reintentando IA para ${tasks.length} tarea(s)`);
    const secret = this.configService.get<string>('N8N_SECRET_KEY', '');

    for (const task of tasks) {
      try {
        this.logger.log(`[Scheduler] Procesando tarea: "${task.title}" (ID: ${task.id})`);
        this.logger.log(`[Scheduler] Descripción original: ${task.description?.substring(0, 200) || '(vacía)'}`);

        // ── Candado anti-duplicados ─────────────────────────────────
        try {
          await this.tasksService.acquireProcessingLock(task.id);
        } catch (lockErr: any) {
          this.logger.warn(`  ⏭ Tarea "${task.title}": ${lockErr.message}`);
          continue;
        }

        // Enriquecer descripción con contenido de PDFs/DOCX adjuntos
        const enrichedDescription = await this.documentParser.enrichDescription(
          task.description ?? '',
        );

        const payload = {
          taskId:      task.id,
          title:       task.title,
          description: enrichedDescription,
          dueDate:     task.dueDate ? new Date(task.dueDate).toISOString() : '',
          assignedDate: task.assignedDate ? new Date(task.assignedDate).toISOString() : '',
          subjectName: task.subject?.name ?? '',
        };

        this.logger.log(`[Scheduler] Payload enviado a n8n:`);
        this.logger.log(`  URL: ${n8nUrl}`);
        this.logger.log(`  taskId: ${payload.taskId}`);
        this.logger.log(`  title: ${payload.title}`);
        this.logger.log(`  description length: ${payload.description?.length || 0} chars`);
        this.logger.log(`  dueDate: ${payload.dueDate}`);
        this.logger.log(`  assignedDate: ${payload.assignedDate}`);
        this.logger.log(`  subjectName: ${payload.subjectName}`);
        this.logger.log(`  description preview: ${payload.description?.substring(0, 300)}...`);

        const response = await axios.post(
          n8nUrl,
          payload,
          {
            headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
            timeout: 120_000,
          },
        );

        // n8n now returns the solution directly in the response
        const solutionData = response.data;
        this.logger.log(`  ✓ n8n respondió para "${task.title}"`);
        this.logger.log(`  ✓ Respuesta n8n: taskType=${solutionData.taskType}, subjectName=${solutionData.subjectName}, content length=${solutionData.content?.length || 0}`);

        // Process the solution directly
        if (solutionData.content && solutionData.taskType) {
          await this.tasksService.processAiCallback(task.id, {
            content:     solutionData.content,
            subjectName: solutionData.subjectName || '',
            taskType:    solutionData.taskType,
          });
          this.logger.log(`  ✓ Solución procesada y guardada para "${task.title}"`);
        } else {
          this.logger.warn(`  ⚠ Respuesta de n8n incompleta para "${task.title}": ${JSON.stringify(solutionData).substring(0, 300)}`);
          // Revertir a PENDING si la respuesta es inválida
          await this.tasksService.releaseProcessingLock(task.id, TaskStatus.PENDING);
        }
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_MS));
      } catch (err: any) {
        // Si falla (quota de Gemini agotada), detenemos el lote
        this.logger.warn(`  ✗ "${task.title}": ${err.message} — abortando ciclo`);
        if (err.response) {
          this.logger.warn(`  Respuesta n8n: status=${err.response.status}, data=${JSON.stringify(err.response.data).substring(0, 500)}`);
        }
        // Revertir a PENDING para permitir reintento
        await this.tasksService.releaseProcessingLock(task.id, TaskStatus.PENDING).catch(() => {});
        break;
      }
    }
  }
}
