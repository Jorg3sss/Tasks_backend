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
var TasksService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const path_1 = require("path");
const task_entity_1 = require("./entities/task.entity");
const solution_entity_1 = require("./entities/solution.entity");
const task_status_enum_1 = require("./entities/task-status.enum");
const pdf_service_1 = require("./pdf.service");
const zip_service_1 = require("./zip.service");
const subjects_service_1 = require("../subjects/subjects.service");
const mail_service_1 = require("../mail/mail.service");
const config_1 = require("@nestjs/config");
const covers_service_1 = require("../covers/covers.service");
const document_parser_service_1 = require("../common/document-parser.service");
let TasksService = TasksService_1 = class TasksService {
    constructor(taskRepo, solutionRepo, pdfService, zipService, subjectsService, mailService, configService, coversService, documentParser) {
        this.taskRepo = taskRepo;
        this.solutionRepo = solutionRepo;
        this.pdfService = pdfService;
        this.zipService = zipService;
        this.subjectsService = subjectsService;
        this.mailService = mailService;
        this.configService = configService;
        this.coversService = coversService;
        this.documentParser = documentParser;
        this.logger = new common_1.Logger(TasksService_1.name);
    }
    async countByUser(userId) {
        return this.taskRepo.count({ where: { userId } });
    }
    async findAllByUser(userId, filters) {
        const qb = this.taskRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.subject', 'subject')
            .leftJoinAndSelect('task.solution', 'solution')
            .where('task.userId = :userId', { userId })
            .orderBy('task.dueDate', 'DESC');
        if (filters.status)
            qb.andWhere('task.status = :status', { status: filters.status });
        if (filters.type)
            qb.andWhere('task.type = :type', { type: filters.type });
        if (filters.subjectId)
            qb.andWhere('task.subjectId = :subjectId', { subjectId: filters.subjectId });
        if (filters.from)
            qb.andWhere('task.dueDate >= :from', { from: filters.from });
        if (filters.to)
            qb.andWhere('task.dueDate <= :to', { to: filters.to });
        return qb.getMany();
    }
    async findById(taskId) {
        const task = await this.taskRepo.findOne({
            where: { id: taskId },
            relations: ['subject', 'solution', 'user'],
        });
        if (!task)
            throw new common_1.NotFoundException(`Tarea ${taskId} no encontrada.`);
        return task;
    }
    async processAiCallback(taskId, payload) {
        const task = await this.findById(taskId);
        if (task.solution) {
            throw new common_1.ConflictException(`La tarea ${taskId} ya tiene una solución registrada.`);
        }
        const UNKNOWN_KEYWORDS = ['desconocida', 'unknown', 'n/a', ''];
        const normalizedSubject = payload.subjectName.trim().toLowerCase();
        let newSubjectId = task.subjectId;
        if (!UNKNOWN_KEYWORDS.includes(normalizedSubject)) {
            const subject = await this.subjectsService.findOrCreate(task.userId, payload.subjectName.trim());
            newSubjectId = subject.id;
        }
        await this.taskRepo.update(taskId, {
            type: payload.taskType,
            status: task_status_enum_1.TaskStatus.COMPLETED,
            subjectId: newSubjectId,
        });
        const userCover = await this.coversService.findByUser(task.userId);
        const customCoverPath = userCover?.pdfUrl
            ? (0, path_1.join)(process.cwd(), 'public', userCover.pdfUrl)
            : undefined;
        const pdfRelativePath = await this.pdfService.generateSolutionPdf(task.title, payload.content, taskId, payload.taskType, {
            studentName: `${task.user.nombres} ${task.user.apellidoPaterno} ${task.user.apellidoMaterno}`.trim(),
            subject: task.subject?.name ?? payload.subjectName ?? 'Sin materia',
            semestre: task.user.semestre ?? '',
            licenciatura: task.user.licenciatura ?? '',
            dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
            correo: task.user.correo,
        }, customCoverPath);
        let zipUrl = null;
        if (payload.taskType === 'CODE_SNIPPET') {
            zipUrl = await this.zipService.generateZipFromMarkdown(payload.content, taskId);
        }
        const solution = this.solutionRepo.create({
            contenidoMarkdown: payload.content,
            pdfUrl: pdfRelativePath,
            zipUrl,
            taskId,
        });
        const saved = await this.solutionRepo.save(solution);
        this.logger.log(`Solución guardada para tarea "${task.title}" (${taskId})${zipUrl ? ' + ZIP' : ''}`);
        const baseUrl = this.configService.get('APP_BASE_URL', 'http://localhost:3001');
        const pdfPublicUrl = `${baseUrl}${pdfRelativePath}`;
        const userEmail = task.user.correo;
        await this.mailService.sendTaskReadyEmail(userEmail, task.title, pdfPublicUrl);
        return saved;
    }
    async requestSolution(taskId, userId) {
        const task = await this.taskRepo.findOne({
            where: { id: taskId, userId },
            relations: ['subject'],
        });
        if (!task)
            throw new common_1.NotFoundException(`Tarea ${taskId} no encontrada.`);
        if (task.solution)
            throw new common_1.ConflictException('Esta tarea ya tiene una solución generada.');
        const n8nUrl = this.configService.get('N8N_WEBHOOK_URL');
        if (!n8nUrl)
            throw new common_1.NotFoundException('Servicio de IA no configurado.');
        const secret = this.configService.get('N8N_SECRET_KEY', '');
        const enrichedDescription = await this.documentParser.enrichDescription(task.description ?? '');
        const { default: axios } = await Promise.resolve().then(() => require('axios'));
        const response = await axios.post(n8nUrl, {
            taskId: task.id,
            title: task.title,
            description: enrichedDescription,
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : '',
            assignedDate: task.assignedDate ? new Date(task.assignedDate).toISOString() : '',
            subjectName: task.subject?.name ?? '',
        }, {
            headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
            timeout: 120_000,
        });
        const solutionData = response.data;
        this.logger.log(`Solución recibida de n8n para "${task.title}" (${taskId})`);
        this.logger.log(`  taskType=${solutionData.taskType}, subjectName=${solutionData.subjectName}, content length=${solutionData.content?.length || 0}`);
        if (solutionData.content && solutionData.taskType) {
            await this.processAiCallback(taskId, {
                content: solutionData.content,
                subjectName: solutionData.subjectName || '',
                taskType: solutionData.taskType,
            });
            this.logger.log(`Solución procesada y guardada para "${task.title}" (${taskId})`);
        }
        return { queued: true };
    }
    async createFromCalendar(data) {
        const existing = await this.taskRepo.findOne({
            where: { externalEventId: data.externalEventId },
        });
        if (existing)
            return existing;
        let subjectId = null;
        if (data.subjectName?.trim()) {
            const UNKNOWN = ['desconocida', 'unknown', 'n/a', 'otro', 'other'];
            const normalized = data.subjectName.trim().toLowerCase();
            if (!UNKNOWN.includes(normalized)) {
                try {
                    const subject = await this.subjectsService.findOrCreate(data.userId, data.subjectName.trim());
                    subjectId = subject.id;
                }
                catch (e) {
                    this.logger.warn(`No se pudo crear materia "${data.subjectName}": ${e.message}`);
                }
            }
        }
        const { subjectName: _, ...rest } = data;
        const task = this.taskRepo.create({
            ...rest,
            subjectId,
            type: data.type ?? 'OTHER',
            status: task_status_enum_1.TaskStatus.PENDING,
        });
        return this.taskRepo.save(task);
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = TasksService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(task_entity_1.Task)),
    __param(1, (0, typeorm_1.InjectRepository)(solution_entity_1.Solution)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        pdf_service_1.PdfService,
        zip_service_1.ZipService,
        subjects_service_1.SubjectsService,
        mail_service_1.MailService,
        config_1.ConfigService,
        covers_service_1.CoversService,
        document_parser_service_1.DocumentParserService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map