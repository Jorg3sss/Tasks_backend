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
var SchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const task_entity_1 = require("../tasks/entities/task.entity");
const tasks_service_1 = require("../tasks/tasks.service");
const document_parser_service_1 = require("../common/document-parser.service");
const RETRY_INTERVAL_MS = 10 * 60 * 1000;
const INITIAL_DELAY_MS = 45_000;
const MAX_BATCH = 1;
const DELAY_BETWEEN_MS = 5_000;
let SchedulerService = SchedulerService_1 = class SchedulerService {
    constructor(taskRepo, configService, documentParser, tasksService) {
        this.taskRepo = taskRepo;
        this.configService = configService;
        this.documentParser = documentParser;
        this.tasksService = tasksService;
        this.logger = new common_1.Logger(SchedulerService_1.name);
    }
    onModuleInit() {
        setTimeout(() => this.retryPendingAiSolutions(), INITIAL_DELAY_MS);
        setInterval(() => this.retryPendingAiSolutions(), RETRY_INTERVAL_MS);
    }
    async retryPendingAiSolutions() {
        const n8nUrl = this.configService.get('N8N_WEBHOOK_URL');
        if (!n8nUrl)
            return;
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
        const secret = this.configService.get('N8N_SECRET_KEY', '');
        for (const task of tasks) {
            try {
                this.logger.log(`[Scheduler] Procesando tarea: "${task.title}" (ID: ${task.id})`);
                this.logger.log(`[Scheduler] Descripción original: ${task.description?.substring(0, 200) || '(vacía)'}`);
                const enrichedDescription = await this.documentParser.enrichDescription(task.description ?? '');
                const payload = {
                    taskId: task.id,
                    title: task.title,
                    description: enrichedDescription,
                    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : '',
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
                const response = await axios_1.default.post(n8nUrl, payload, {
                    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
                    timeout: 120_000,
                });
                const solutionData = response.data;
                this.logger.log(`  ✓ n8n respondió para "${task.title}"`);
                this.logger.log(`  ✓ Respuesta n8n: taskType=${solutionData.taskType}, subjectName=${solutionData.subjectName}, content length=${solutionData.content?.length || 0}`);
                if (solutionData.content && solutionData.taskType) {
                    await this.tasksService.processAiCallback(task.id, {
                        content: solutionData.content,
                        subjectName: solutionData.subjectName || '',
                        taskType: solutionData.taskType,
                    });
                    this.logger.log(`  ✓ Solución procesada y guardada para "${task.title}"`);
                }
                else {
                    this.logger.warn(`  ⚠ Respuesta de n8n incompleta para "${task.title}": ${JSON.stringify(solutionData).substring(0, 300)}`);
                }
                await new Promise(r => setTimeout(r, DELAY_BETWEEN_MS));
            }
            catch (err) {
                this.logger.warn(`  ✗ "${task.title}": ${err.message} — abortando ciclo`);
                if (err.response) {
                    this.logger.warn(`  Respuesta n8n: status=${err.response.status}, data=${JSON.stringify(err.response.data).substring(0, 500)}`);
                }
                break;
            }
        }
    }
};
exports.SchedulerService = SchedulerService;
exports.SchedulerService = SchedulerService = SchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(task_entity_1.Task)),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => tasks_service_1.TasksService))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService,
        document_parser_service_1.DocumentParserService,
        tasks_service_1.TasksService])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map