import {
  Injectable, NotFoundException,
  ConflictException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { join }             from 'path';
import { Task }             from './entities/task.entity';
import { Solution }         from './entities/solution.entity';
import { TaskStatus }       from './entities/task-status.enum';
import { GetTasksFilterDto }  from './dto/get-tasks-filter.dto';
import { PdfService }         from './pdf.service';
import { ZipService }         from './zip.service';
import { SubjectsService }    from '../subjects/subjects.service';
import { MailService }        from '../mail/mail.service';
import { WebhookSolutionDto } from '../webhooks/dto/webhook-solution.dto';
import { ConfigService }      from '@nestjs/config';
import { CoversService }      from '../covers/covers.service';
import { DocumentParserService } from '../common/document-parser.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,

    @InjectRepository(Solution)
    private readonly solutionRepo: Repository<Solution>,

    private readonly pdfService:      PdfService,
    private readonly zipService:      ZipService,
    private readonly subjectsService: SubjectsService,
    private readonly mailService:     MailService,
    private readonly configService:   ConfigService,
    private readonly coversService:   CoversService,
    private readonly documentParser:  DocumentParserService,
  ) {}

  // ── Consultas ──────────────────────────────────────────────────────

  async countByUser(userId: string): Promise<number> {
    return this.taskRepo.count({ where: { userId } });
  }

  async findAllByUser(
    userId: string,
    filters: GetTasksFilterDto,
  ): Promise<Task[]> {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.subject',  'subject')
      .leftJoinAndSelect('task.solution', 'solution')
      .where('task.userId = :userId', { userId })
      .orderBy('task.dueDate', 'DESC');

    if (filters.status)    qb.andWhere('task.status = :status',       { status:    filters.status });
    if (filters.type)      qb.andWhere('task.type = :type',           { type:      filters.type });
    if (filters.subjectId) qb.andWhere('task.subjectId = :subjectId', { subjectId: filters.subjectId });
    if (filters.from)      qb.andWhere('task.dueDate >= :from',       { from:      filters.from });
    if (filters.to)        qb.andWhere('task.dueDate <= :to',         { to:        filters.to });

    return qb.getMany();
  }

  async findById(taskId: string): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where:     { id: taskId },
      relations: ['subject', 'solution', 'user'],
    });
    if (!task) throw new NotFoundException(`Tarea ${taskId} no encontrada.`);
    return task;
  }

  // ── Callback de n8n (flujo principal de IA) ───────────────────────

  /**
   * Orquesta la respuesta completa del webhook de n8n:
   *   1. Busca la tarea (con user para tener correo y userId)
   *   2. Resuelve la asignatura (findOrCreate o null si "DESCONOCIDA")
   *   3. Actualiza type y status → COMPLETED
   *   4. Genera el PDF
   *   5. Persiste la SolutionEntity
   *   6. Envía el correo de notificación
   */
  async processAiCallback(
    taskId: string,
    payload: WebhookSolutionDto,
  ): Promise<Solution> {
    const task = await this.findById(taskId);

    if (task.solution) {
      throw new ConflictException(
        `La tarea ${taskId} ya tiene una solución registrada.`,
      );
    }

    // ── 1. Resolver asignatura ──────────────────────────────────────
    const UNKNOWN_KEYWORDS = ['desconocida', 'unknown', 'n/a', ''];
    const normalizedSubject = payload.subjectName.trim().toLowerCase();
    let newSubjectId: string | null = task.subjectId; // conservar la que ya tiene

    if (!UNKNOWN_KEYWORDS.includes(normalizedSubject)) {
      const subject = await this.subjectsService.findOrCreate(
        task.userId,
        payload.subjectName.trim(),
      );
      newSubjectId = subject.id;
    }

    // ── 2. Actualizar tipo y asignatura ────────────────────────────
    await this.taskRepo.update(taskId, {
      type:      payload.taskType,
      status:    TaskStatus.COMPLETED,
      subjectId: newSubjectId,
    });

    // ── 3. Generar PDF con portada ─────────────────────────────────
    // Buscar portada personalizada del usuario
    const userCover = await this.coversService.findByUser(task.userId);
    const customCoverPath = userCover?.pdfUrl
      ? join(process.cwd(), 'public', userCover.pdfUrl)
      : undefined;

    const pdfRelativePath = await this.pdfService.generateSolutionPdf(
      task.title,
      payload.content,
      taskId,
      payload.taskType,
      {
        studentName:  `${task.user.nombres} ${task.user.apellidoPaterno} ${task.user.apellidoMaterno}`.trim(),
        subject:      task.subject?.name ?? payload.subjectName ?? 'Sin materia',
        semestre:     task.user.semestre    ?? '',
        licenciatura: task.user.licenciatura ?? '',
        dueDate:      task.dueDate ? new Date(task.dueDate) : undefined,
        correo:       task.user.correo,
      },
      customCoverPath,
    );

    // ── 4. Generar ZIP para tareas de código ───────────────────────
    let zipUrl: string | null = null;
    if (payload.taskType === 'CODE_SNIPPET') {
      zipUrl = await this.zipService.generateZipFromMarkdown(payload.content, taskId);
    }

    // ── 5. Persistir solución ──────────────────────────────────────
    const solution = this.solutionRepo.create({
      contenidoMarkdown: payload.content,
      pdfUrl:  pdfRelativePath,
      zipUrl,
      taskId,
    });
    const saved = await this.solutionRepo.save(solution);

    this.logger.log(`Solución guardada para tarea "${task.title}" (${taskId})${zipUrl ? ' + ZIP' : ''}`);

    // ── 6. Enviar correo al alumno (email desde task.user) ─────────
    const baseUrl      = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3001');
    const pdfPublicUrl = `${baseUrl}${pdfRelativePath}`;
    const userEmail    = task.user.correo; // fuente confiable, no depende de n8n

    await this.mailService.sendTaskReadyEmail(
      userEmail,
      task.title,
      pdfPublicUrl,
    );

    return saved;
  }

  // ── Solicitud manual de solución IA ───────────────────────────────

  /**
   * Permite al usuario pedir explícitamente la generación de solución
   * para tareas OVERDUE o SUBMITTED (que el scheduler no procesa).
   * Si la tarea ya tiene solución, lanza ConflictException.
   */
  async requestSolution(taskId: string, userId: string): Promise<{ queued: boolean }> {
    const task = await this.taskRepo.findOne({
      where:     { id: taskId, userId },
      relations: ['subject'],
    });
    if (!task) throw new NotFoundException(`Tarea ${taskId} no encontrada.`);
    if (task.solution) throw new ConflictException('Esta tarea ya tiene una solución generada.');

    const n8nUrl = this.configService.get<string>('N8N_WEBHOOK_URL');
    if (!n8nUrl) throw new NotFoundException('Servicio de IA no configurado.');

    const secret = this.configService.get<string>('N8N_SECRET_KEY', '');

    // Enriquecer descripción con contenido de PDFs/DOCX adjuntos
    const enrichedDescription = await this.documentParser.enrichDescription(
      task.description ?? '',
    );

    const { default: axios } = await import('axios');
    const response = await axios.post(
      n8nUrl,
      {
        taskId:      task.id,
        title:       task.title,
        description: enrichedDescription,
        dueDate:     task.dueDate  ? new Date(task.dueDate).toISOString()  : '',
        assignedDate: task.assignedDate ? new Date(task.assignedDate).toISOString() : '',
        subjectName: task.subject?.name ?? '',
      },
      {
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
        timeout: 120_000,
      },
    );

    // n8n now returns the solution directly in the response
    const solutionData = response.data;
    this.logger.log(`Solución recibida de n8n para "${task.title}" (${taskId})`);
    this.logger.log(`  taskType=${solutionData.taskType}, subjectName=${solutionData.subjectName}, content length=${solutionData.content?.length || 0}`);

    if (solutionData.content && solutionData.taskType) {
      await this.processAiCallback(taskId, {
        content:     solutionData.content,
        subjectName: solutionData.subjectName || '',
        taskType:    solutionData.taskType,
      });
      this.logger.log(`Solución procesada y guardada para "${task.title}" (${taskId})`);
    }

    return { queued: true };
  }

  // ── Creación desde .ics ────────────────────────────────────────────

  async createFromCalendar(data: {
    userId: string;
    subjectName?: string | null;
    externalEventId: string;
    title: string;
    description?: string;
    assignedDate: Date;
    dueDate: Date;
    type?: string;
  }): Promise<Task> {
    const existing = await this.taskRepo.findOne({
      where: { externalEventId: data.externalEventId },
    });
    if (existing) return existing;

    // Resolve subject from name if provided
    let subjectId: string | null = null;
    if (data.subjectName?.trim()) {
      const UNKNOWN = ['desconocida', 'unknown', 'n/a', 'otro', 'other'];
      const normalized = data.subjectName.trim().toLowerCase();
      if (!UNKNOWN.includes(normalized)) {
        try {
          const subject = await this.subjectsService.findOrCreate(
            data.userId,
            data.subjectName.trim(),
          );
          subjectId = subject.id;
        } catch (e: any) {
          this.logger.warn(`No se pudo crear materia "${data.subjectName}": ${e.message}`);
        }
      }
    }

    const { subjectName: _, ...rest } = data;
    const task = this.taskRepo.create({
      ...rest,
      subjectId,
      type:   (data.type as any) ?? 'OTHER',
      status: TaskStatus.PENDING,
    });
    return this.taskRepo.save(task);
  }
}
