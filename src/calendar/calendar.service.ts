import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService }    from '@nestjs/config';
import { Repository }       from 'typeorm';
import axios                from 'axios';
import * as ical            from 'node-ical';
import * as fs              from 'fs';
import * as path            from 'path';
import { User }             from '../users/entities/user.entity';
import { TasksService }     from '../tasks/tasks.service';
import { TaskStatus }       from '../tasks/entities/task-status.enum';
import { RegisterCalendarDto } from './dto/register-calendar.dto';
import { DocumentParserService } from '../common/document-parser.service';

/** Palabras clave que identifican tareas de asistencia (no requieren solución IA). */
const ATTENDANCE_KEYWORDS = [
  'asistencia',
  'pase de lista',
  'pases de lista',
  'lista de asistencia',
  'attendance',
  'check-in',
  'check in',
  'firma',
  'pase lista',
];

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private readonly logFilePath: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tasksService:       TasksService,
    private readonly configService:      ConfigService,
    private readonly documentParser:     DocumentParserService,
  ) {
    // Archivo de log para bugs y soluciones
    this.logFilePath = path.join(process.cwd(), 'logs', 'bugs-and-solutions.log');
    const logsDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /** Escribe una entrada en el archivo de log de bugs y soluciones. */
  private appendLog(type: 'BUG' | 'SOLUTION' | 'SKIP' | 'INFO', message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${type}] ${message}\n`;
    try {
      fs.appendFileSync(this.logFilePath, entry, 'utf-8');
    } catch (err) {
      this.logger.warn(`No se pudo escribir en el log: ${err}`);
    }
  }

  /** Verifica si el título o descripción corresponde a una tarea de asistencia. */
  private isAttendanceTask(title: string, description: string): boolean {
    const text = `${title} ${description}`.toLowerCase();
    return ATTENDANCE_KEYWORDS.some(kw => text.includes(kw));
  }

  // ── Registro de URL ────────────────────────────────────────────────

  async registerCalendar(
    userId: string,
    dto: RegisterCalendarDto,
  ): Promise<{ message: string; calendarUrl: string }> {
    // 1. Verificar que la URL responde
    try {
      await axios.get(dto.calendarUrl, {
        timeout: 8000,
        responseType: 'stream',
        maxRedirects: 5,
      });
    } catch (err: any) {
      this.logger.warn(`URL no accesible: ${dto.calendarUrl} — ${err.message}`);
      throw new BadRequestException(
        'No se pudo acceder a la URL del calendario. Verifica que sea pública y esté activa.',
      );
    }

    // 2. Persistir URL
    await this.userRepo.update(userId, { calendarUrl: dto.calendarUrl });
    this.logger.log(`Usuario ${userId} registró calendario: ${dto.calendarUrl}`);

    // 3. Procesar en background (fire-and-forget)
    void this.processCalendarData(dto.calendarUrl, userId);

    return {
      message: 'Calendario registrado. Las tareas se sincronizarán en breve.',
      calendarUrl: dto.calendarUrl,
    };
  }

  // ── Sincronización manual (botón "Actualizar") ─────────────────────

  async syncCalendar(userId: string): Promise<{ message: string; newTasks: number }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.calendarUrl) {
      throw new BadRequestException('No tienes un calendario registrado.');
    }

    const countBefore = await this.tasksService.countByUser(userId);
    await this.processCalendarData(user.calendarUrl, userId);
    const countAfter = await this.tasksService.countByUser(userId);
    const newTasks = countAfter - countBefore;

    this.logger.log(`Sync manual usuario ${userId}: ${newTasks} tarea(s) nueva(s)`);
    return {
      message: newTasks > 0
        ? `Se sincronizaron ${newTasks} tarea(s) nueva(s).`
        : 'No hay tareas nuevas en el calendario.',
      newTasks,
    };
  }

  // ── Parser .ics + envío a n8n ──────────────────────────────────────

  async processCalendarData(url: string, userId: string): Promise<void> {
    this.logger.log(`Sincronizando calendario para usuario ${userId}`);

    // 1. Descargar y parsear el .ics
    let events: ical.CalendarResponse;
    try {
      events = await ical.async.fromURL(url);
    } catch (err: any) {
      this.logger.error(`Error descargando ICS: ${err.message}`);
      return;
    }

    const n8nWebhookUrl = this.configService.get<string>('N8N_WEBHOOK_URL');
    if (!n8nWebhookUrl) {
      this.logger.error('N8N_WEBHOOK_URL no configurada — abortando sincronización');
      return;
    }

    const n8nSecret = this.configService.get<string>('N8N_SECRET_KEY', '');

    // DEBUG: Log all parsed events as array
    const parsedEvents = Object.entries(events)
      .filter(([, event]) => event.type === 'VEVENT')
      .map(([key, event]) => {
        const e = event as any;
        let categories: string[] = [];
        if (e.categories) {
          if (typeof e.categories === 'string') categories = [e.categories];
          else if (Array.isArray(e.categories)) categories = e.categories;
          else categories = Object.values(e.categories);
        }
        return {
          uid: e.uid,
          summary: e.summary,
          description: e.description?.substring(0, 100) + (e.description?.length > 100 ? '...' : ''),
          dtstart: e.start?.toISOString(),
          dtend: e.end?.toISOString(),
          categories,
        };
      });

    this.logger.log(`[Calendar] Eventos parseados del ICS (${parsedEvents.length}):`);
    this.logger.log(JSON.stringify(parsedEvents, null, 2));

    // 2. Iterar sobre los eventos
    for (const [, event] of Object.entries(events)) {
      if (event.type !== 'VEVENT') continue;

      const uid         = (event as any).uid  as string | undefined;
      const summary     = (event as any).summary as string | undefined;
      const description = (event as any).description as string | undefined;
      const dtstart     = (event as any).start as Date | undefined;
      const dtend       = (event as any).end   as Date | undefined;
      const categories  = (event as any).categories as Record<string, string> | string | undefined;

      if (!uid || !summary || !dtstart) {
        this.logger.warn(`Evento sin UID/SUMMARY/DTSTART — omitido`);
        continue;
      }

      // Extraer materia desde CATEGORIES del ICS
      // node-ical puede devolver string, array, o Record<string,string>
      let subjectName: string | undefined;
      if (categories) {
        let catList: string[];
        if (typeof categories === 'string') {
          catList = [categories];
        } else if (Array.isArray(categories)) {
          catList = categories;
        } else {
          catList = Object.values(categories as Record<string, string>);
        }
        if (catList.length > 0 && catList[0]) {
          subjectName = catList[0].trim().replace(/\.+$/, ''); // quitar puntos al final
        }
      }

      // 3. Detectar si es tarea de asistencia
      const isAttendance = this.isAttendanceTask(summary, description ?? '');

      // 4. Crear la tarea en BD (idempotente por externalEventId)
      let task: { id: string } | null = null;
      try {
        task = await this.tasksService.createFromCalendar({
          userId,
          subjectName,
          externalEventId: uid,
          title:           summary.trim(),
          description:     description?.trim() ?? '',
          assignedDate:    dtstart,
          dueDate:         dtend ?? dtstart,
          type:            isAttendance ? 'ATTENDANCE' : undefined,
        });
      } catch (err: any) {
        this.logger.error(`Error creando tarea "${summary}": ${err.message}`);
        continue;
      }

      // 5. Si es asistencia, marcar como completada y saltar n8n
      if (isAttendance) {
        this.logger.log(`Tarea de asistencia detectada: "${summary}" — omitiendo análisis IA`);
        this.appendLog('SKIP', `Tarea de asistencia omitida: "${summary}" (taskId=${task.id})`);
        continue;
      }

      // 6. Verificar si la tarea ya tiene solución — omitir sin error
      const existingTask = await this.tasksService.findById(task.id);
      if (existingTask.solution) {
        this.logger.log(`  ⏭ Tarea "${summary}" ya tiene solución — omitiendo envío a n8n`);
        this.appendLog('SKIP', `Tarea ya resuelta, omitida: "${summary}" (taskId=${task.id})`);
        continue;
      }

      // 7. Llamar a n8n para que Gemini analice la tarea
      // Enriquecer descripción con contenido de PDFs/DOCX adjuntos
      const enrichedDescription = await this.documentParser.enrichDescription(
        description?.trim() ?? '',
      );

      // ── Candado anti-duplicados ───────────────────────────────────
      try {
        await this.tasksService.acquireProcessingLock(task.id);
      } catch (lockErr: any) {
        this.logger.warn(`  ⏭ Tarea "${summary}": ${lockErr.message}`);
        continue;
      }

      const n8nPayload = {
        taskId:      task.id,
        title:       summary.trim(),
        description: enrichedDescription,
        dueDate:     dtend?.toISOString() ?? dtstart.toISOString(),
        assignedDate: dtstart.toISOString(),
        subjectName:  subjectName ?? '',
      };

      this.logger.log(`[Calendar] Enviando a n8n:`);
      this.logger.log(`  URL: ${n8nWebhookUrl}`);
      this.logger.log(`  taskId: ${n8nPayload.taskId}`);
      this.logger.log(`  title: ${n8nPayload.title}`);
      this.logger.log(`  description length: ${n8nPayload.description?.length || 0} chars`);
      this.logger.log(`  dueDate: ${n8nPayload.dueDate}`);
      this.logger.log(`  assignedDate: ${n8nPayload.assignedDate}`);
      this.logger.log(`  subjectName: ${n8nPayload.subjectName}`);
      this.logger.log(`  description preview: ${n8nPayload.description?.substring(0, 300)}...`);

      try {
        const response = await axios.post(
          n8nWebhookUrl,
          n8nPayload,
          {
            headers: {
              'Content-Type':    'application/json',
              'x-webhook-secret': n8nSecret,
            },
            timeout: 120_000, // Gemini puede tardar
          },
        );

        // n8n now returns the solution directly in the response
        const solutionData = response.data;
        this.logger.log(`  ✓ n8n respondió para "${summary}"`);
        this.logger.log(`  ✓ Respuesta: taskType=${solutionData.taskType}, subjectName=${solutionData.subjectName}, content length=${solutionData.content?.length || 0}`);

        // Process the solution directly
        if (solutionData.content && solutionData.taskType) {
          await this.tasksService.processAiCallback(task.id, {
            content:     solutionData.content,
            subjectName: solutionData.subjectName || '',
            taskType:    solutionData.taskType,
          });
          this.logger.log(`  ✓ Solución procesada y guardada para "${summary}"`);
          this.appendLog('SOLUTION', `Solución generada para: "${summary}" (taskId=${task.id}, taskType=${solutionData.taskType}, contentLength=${solutionData.content.length})`);
        } else {
          const respPreview = JSON.stringify(solutionData)?.substring(0, 300) ?? 'N/A';
          this.logger.warn(`  ⚠ Respuesta de n8n incompleta para "${summary}": ${respPreview}`);
          this.appendLog('BUG', `Respuesta n8n incompleta para: "${summary}" (taskId=${task.id}). Preview: ${respPreview}`);
          // Revertir a PENDING si la respuesta es inválida
          await this.tasksService.releaseProcessingLock(task.id, TaskStatus.PENDING);
        }
      } catch (err: any) {
        const errMsg = err.message || 'Error desconocido';
        this.logger.error(`Error llamando a n8n para "${summary}": ${errMsg}`);
        if (err.response) {
          const respData = JSON.stringify(err.response.data)?.substring(0, 500) ?? 'N/A';
          this.logger.error(`  Respuesta n8n: status=${err.response.status}, data=${respData}`);
          this.appendLog('BUG', `Error n8n para: "${summary}" (taskId=${task.id}). Status=${err.response.status}. Data=${respData}`);
        } else {
          this.appendLog('BUG', `Error llamando a n8n para: "${summary}" (taskId=${task.id}). Error: ${errMsg}`);
        }
        // Revertir a PENDING para permitir reintento del scheduler
        await this.tasksService.releaseProcessingLock(task.id, TaskStatus.PENDING).catch(() => {});
        // Continuar con el siguiente evento — no abortar todo el lote
        continue;
      }
    }

    this.logger.log(`Sincronización completada para usuario ${userId}`);
  }
}
