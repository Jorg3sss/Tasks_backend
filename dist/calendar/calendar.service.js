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
var CalendarService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const typeorm_2 = require("typeorm");
const axios_1 = require("axios");
const ical = require("node-ical");
const fs = require("fs");
const path = require("path");
const user_entity_1 = require("../users/entities/user.entity");
const tasks_service_1 = require("../tasks/tasks.service");
const document_parser_service_1 = require("../common/document-parser.service");
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
let CalendarService = CalendarService_1 = class CalendarService {
    constructor(userRepo, tasksService, configService, documentParser) {
        this.userRepo = userRepo;
        this.tasksService = tasksService;
        this.configService = configService;
        this.documentParser = documentParser;
        this.logger = new common_1.Logger(CalendarService_1.name);
        this.logFilePath = path.join(process.cwd(), 'logs', 'bugs-and-solutions.log');
        const logsDir = path.dirname(this.logFilePath);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
    }
    appendLog(type, message) {
        const timestamp = new Date().toISOString();
        const entry = `[${timestamp}] [${type}] ${message}\n`;
        try {
            fs.appendFileSync(this.logFilePath, entry, 'utf-8');
        }
        catch (err) {
            this.logger.warn(`No se pudo escribir en el log: ${err}`);
        }
    }
    isAttendanceTask(title, description) {
        const text = `${title} ${description}`.toLowerCase();
        return ATTENDANCE_KEYWORDS.some(kw => text.includes(kw));
    }
    async registerCalendar(userId, dto) {
        try {
            await axios_1.default.get(dto.calendarUrl, {
                timeout: 8000,
                responseType: 'stream',
                maxRedirects: 5,
            });
        }
        catch (err) {
            this.logger.warn(`URL no accesible: ${dto.calendarUrl} — ${err.message}`);
            throw new common_1.BadRequestException('No se pudo acceder a la URL del calendario. Verifica que sea pública y esté activa.');
        }
        await this.userRepo.update(userId, { calendarUrl: dto.calendarUrl });
        this.logger.log(`Usuario ${userId} registró calendario: ${dto.calendarUrl}`);
        void this.processCalendarData(dto.calendarUrl, userId);
        return {
            message: 'Calendario registrado. Las tareas se sincronizarán en breve.',
            calendarUrl: dto.calendarUrl,
        };
    }
    async syncCalendar(userId) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user?.calendarUrl) {
            throw new common_1.BadRequestException('No tienes un calendario registrado.');
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
    async processCalendarData(url, userId) {
        this.logger.log(`Sincronizando calendario para usuario ${userId}`);
        let events;
        try {
            events = await ical.async.fromURL(url);
        }
        catch (err) {
            this.logger.error(`Error descargando ICS: ${err.message}`);
            return;
        }
        const n8nWebhookUrl = this.configService.get('N8N_WEBHOOK_URL');
        if (!n8nWebhookUrl) {
            this.logger.error('N8N_WEBHOOK_URL no configurada — abortando sincronización');
            return;
        }
        const n8nSecret = this.configService.get('N8N_SECRET_KEY', '');
        const parsedEvents = Object.entries(events)
            .filter(([, event]) => event.type === 'VEVENT')
            .map(([key, event]) => {
            const e = event;
            let categories = [];
            if (e.categories) {
                if (typeof e.categories === 'string')
                    categories = [e.categories];
                else if (Array.isArray(e.categories))
                    categories = e.categories;
                else
                    categories = Object.values(e.categories);
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
        for (const [, event] of Object.entries(events)) {
            if (event.type !== 'VEVENT')
                continue;
            const uid = event.uid;
            const summary = event.summary;
            const description = event.description;
            const dtstart = event.start;
            const dtend = event.end;
            const categories = event.categories;
            if (!uid || !summary || !dtstart) {
                this.logger.warn(`Evento sin UID/SUMMARY/DTSTART — omitido`);
                continue;
            }
            let subjectName;
            if (categories) {
                let catList;
                if (typeof categories === 'string') {
                    catList = [categories];
                }
                else if (Array.isArray(categories)) {
                    catList = categories;
                }
                else {
                    catList = Object.values(categories);
                }
                if (catList.length > 0 && catList[0]) {
                    subjectName = catList[0].trim().replace(/\.+$/, '');
                }
            }
            const isAttendance = this.isAttendanceTask(summary, description ?? '');
            let task = null;
            try {
                task = await this.tasksService.createFromCalendar({
                    userId,
                    subjectName,
                    externalEventId: uid,
                    title: summary.trim(),
                    description: description?.trim() ?? '',
                    assignedDate: dtstart,
                    dueDate: dtend ?? dtstart,
                    type: isAttendance ? 'ATTENDANCE' : undefined,
                });
            }
            catch (err) {
                this.logger.error(`Error creando tarea "${summary}": ${err.message}`);
                continue;
            }
            if (isAttendance) {
                this.logger.log(`Tarea de asistencia detectada: "${summary}" — omitiendo análisis IA`);
                this.appendLog('SKIP', `Tarea de asistencia omitida: "${summary}" (taskId=${task.id})`);
                continue;
            }
            const existingTask = await this.tasksService.findById(task.id);
            if (existingTask.solution) {
                this.logger.log(`  ⏭ Tarea "${summary}" ya tiene solución — omitiendo envío a n8n`);
                this.appendLog('SKIP', `Tarea ya resuelta, omitida: "${summary}" (taskId=${task.id})`);
                continue;
            }
            const enrichedDescription = await this.documentParser.enrichDescription(description?.trim() ?? '');
            const n8nPayload = {
                taskId: task.id,
                title: summary.trim(),
                description: enrichedDescription,
                dueDate: dtend?.toISOString() ?? dtstart.toISOString(),
                assignedDate: dtstart.toISOString(),
                subjectName: subjectName ?? '',
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
                const response = await axios_1.default.post(n8nWebhookUrl, n8nPayload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-webhook-secret': n8nSecret,
                    },
                    timeout: 120_000,
                });
                const solutionData = response.data;
                this.logger.log(`  ✓ n8n respondió para "${summary}"`);
                this.logger.log(`  ✓ Respuesta: taskType=${solutionData.taskType}, subjectName=${solutionData.subjectName}, content length=${solutionData.content?.length || 0}`);
                if (solutionData.content && solutionData.taskType) {
                    await this.tasksService.processAiCallback(task.id, {
                        content: solutionData.content,
                        subjectName: solutionData.subjectName || '',
                        taskType: solutionData.taskType,
                    });
                    this.logger.log(`  ✓ Solución procesada y guardada para "${summary}"`);
                    this.appendLog('SOLUTION', `Solución generada para: "${summary}" (taskId=${task.id}, taskType=${solutionData.taskType}, contentLength=${solutionData.content.length})`);
                }
                else {
                    const respPreview = JSON.stringify(solutionData)?.substring(0, 300) ?? 'N/A';
                    this.logger.warn(`  ⚠ Respuesta de n8n incompleta para "${summary}": ${respPreview}`);
                    this.appendLog('BUG', `Respuesta n8n incompleta para: "${summary}" (taskId=${task.id}). Preview: ${respPreview}`);
                }
            }
            catch (err) {
                const errMsg = err.message || 'Error desconocido';
                this.logger.error(`Error llamando a n8n para "${summary}": ${errMsg}`);
                if (err.response) {
                    const respData = JSON.stringify(err.response.data)?.substring(0, 500) ?? 'N/A';
                    this.logger.error(`  Respuesta n8n: status=${err.response.status}, data=${respData}`);
                    this.appendLog('BUG', `Error n8n para: "${summary}" (taskId=${task.id}). Status=${err.response.status}. Data=${respData}`);
                }
                else {
                    this.appendLog('BUG', `Error llamando a n8n para: "${summary}" (taskId=${task.id}). Error: ${errMsg}`);
                }
                continue;
            }
        }
        this.logger.log(`Sincronización completada para usuario ${userId}`);
    }
};
exports.CalendarService = CalendarService;
exports.CalendarService = CalendarService = CalendarService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        tasks_service_1.TasksService,
        config_1.ConfigService,
        document_parser_service_1.DocumentParserService])
], CalendarService);
//# sourceMappingURL=calendar.service.js.map