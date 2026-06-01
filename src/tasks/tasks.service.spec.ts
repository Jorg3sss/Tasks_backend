import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Task } from './entities/task.entity';
import { Solution } from './entities/solution.entity';
import { TaskStatus } from './entities/task-status.enum';
import { TaskType } from './entities/task-type.enum';
import { PdfService } from './pdf.service';
import { ZipService } from './zip.service';
import { SubjectsService } from '../subjects/subjects.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { CoversService } from '../covers/covers.service';
import { DocumentParserService } from '../common/document-parser.service';
import { SolucionValidatorService } from '../harness/solucion-validator.service';
import { PresentationValidatorService } from '../harness/presentation-validator.service';

describe('TasksService', () => {
  let service: TasksService;
  let taskRepo: any;
  let solutionRepo: any;
  let pdfService: any;
  let zipService: any;
  let subjectsService: any;
  let mailService: any;
  let configService: any;
  let coversService: any;
  let documentParser: any;

  const mockTask: Task = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    externalEventId: 'ics-event-123',
    title: 'Ensayo sobre la Revolución Mexicana',
    description: 'Redactar un ensayo de 5 páginas',
    assignedDate: new Date('2026-06-01'),
    dueDate: new Date('2026-06-15'),
    type: TaskType.OTHER,
    status: TaskStatus.PENDING,
    subjectId: null,
    subject: null,
    userId: 'user-uuid-123',
    user: {
      id: 'user-uuid-123',
      nombres: 'Juan',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'López',
      correo: 'juan@example.com',
      semestre: '6to',
      licenciatura: 'Ingeniería',
      password: 'hashed',
      calendarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userSubjects: [],
      tasks: [],
      coverPages: [],
    },
    solution: null,
    createdAt: new Date(),
  };

  const mockTaskRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockSolutionRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockPdfService = {
    generateSolutionPdf: jest.fn(),
  };

  const mockZipService = {
    generateZipFromMarkdown: jest.fn(),
  };

  const mockSubjectsService = {
    findOrCreate: jest.fn(),
  };

  const mockMailService = {
    sendTaskReadyEmail: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        APP_BASE_URL: 'http://localhost:3001',
        N8N_WEBHOOK_URL: 'http://localhost:5678/webhook/ics-task-processor',
        N8N_SECRET_KEY: 'test-secret',
      };
      return config[key] ?? defaultValue;
    }),
  };

  const mockCoversService = {
    findByUser: jest.fn(),
  };

  const mockDocumentParser = {
    enrichDescription: jest.fn(),
  };

  const mockSolucionValidator = {
    validar: jest.fn().mockReturnValue({
      valida: true,
      errores: [],
      estadisticas: { palabras: 500, cuartillasEstimadas: 2, parrafos: 10, lineasCodigo: 0 },
      estilosRenderizado: { fuente: 'Arial', tamanoFuente: 12, interlineado: 1.5 },
    }),
  };

  const mockPresentationValidator = {
    validar: jest.fn().mockReturnValue({
      valida: true,
      errores: [],
      totalSlides: 0,
      layoutsDetectados: {},
    }),
    requiereGeneracionPresentacion: jest.fn().mockReturnValue(false),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: mockTaskRepo },
        { provide: getRepositoryToken(Solution), useValue: mockSolutionRepo },
        { provide: PdfService, useValue: mockPdfService },
        { provide: ZipService, useValue: mockZipService },
        { provide: SubjectsService, useValue: mockSubjectsService },
        { provide: MailService, useValue: mockMailService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CoversService, useValue: mockCoversService },
        { provide: DocumentParserService, useValue: mockDocumentParser },
        { provide: SolucionValidatorService, useValue: mockSolucionValidator },
        { provide: PresentationValidatorService, useValue: mockPresentationValidator },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    taskRepo = mockTaskRepo;
    solutionRepo = mockSolutionRepo;
    pdfService = mockPdfService;
    zipService = mockZipService;
    subjectsService = mockSubjectsService;
    mailService = mockMailService;
    configService = mockConfigService;
    coversService = mockCoversService;
    documentParser = mockDocumentParser;

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processAiCallback', () => {
    const validPayload = {
      content: '# Ensayo\n\nLa Revolución Mexicana fue...',
      subjectName: 'Historia de México',
      taskType: TaskType.ESSAY,
    };

    beforeEach(() => {
      taskRepo.findOne.mockResolvedValue({ ...mockTask });
      mockSubjectsService.findOrCreate.mockResolvedValue({
        id: 'subject-uuid',
        name: 'Historia de México',
      });
      mockCoversService.findByUser.mockResolvedValue(null);
      mockPdfService.generateSolutionPdf.mockResolvedValue('/uploads/pdfs/solucion-test.pdf');
      mockSolutionRepo.create.mockImplementation((data: any) => ({ id: 'solution-uuid', ...data }));
      mockSolutionRepo.save.mockImplementation((data: any) => Promise.resolve(data));
      mockMailService.sendTaskReadyEmail.mockResolvedValue(undefined);
    });

    it('should generate a solution successfully', async () => {
      const result = await service.processAiCallback(mockTask.id, validPayload);

      expect(result).toBeDefined();
      expect(result.contenidoMarkdown).toBe(validPayload.content);
      expect(result.pdfUrl).toBe('/uploads/pdfs/solucion-test.pdf');
      expect(result.taskId).toBe(mockTask.id);
    });

    it('should update task status to COMPLETED', async () => {
      await service.processAiCallback(mockTask.id, validPayload);

      expect(taskRepo.update).toHaveBeenCalledWith(mockTask.id, {
        type: TaskType.ESSAY,
        status: TaskStatus.COMPLETED,
        subjectId: 'subject-uuid',
      });
    });

    it('should create subject when subjectName is provided', async () => {
      await service.processAiCallback(mockTask.id, validPayload);

      expect(subjectsService.findOrCreate).toHaveBeenCalledWith(
        mockTask.userId,
        'Historia de México',
      );
    });

    it('should NOT create subject when subjectName is DESCONOCIDA', async () => {
      const payloadWithUnknown = { ...validPayload, subjectName: 'DESCONOCIDA' };

      await service.processAiCallback(mockTask.id, payloadWithUnknown);

      expect(subjectsService.findOrCreate).not.toHaveBeenCalled();
    });

    it('should send email notification', async () => {
      await service.processAiCallback(mockTask.id, validPayload);

      expect(mailService.sendTaskReadyEmail).toHaveBeenCalledWith(
        'juan@example.com',
        mockTask.title,
        'http://localhost:3001/uploads/pdfs/solucion-test.pdf',
      );
    });

    it('should generate ZIP for CODE_SNIPPET tasks', async () => {
      const codePayload = { ...validPayload, taskType: TaskType.CODE_SNIPPET };
      mockZipService.generateZipFromMarkdown.mockResolvedValue('/uploads/zips/codigo-test.zip');

      await service.processAiCallback(mockTask.id, codePayload);

      expect(zipService.generateZipFromMarkdown).toHaveBeenCalled();
    });

    it('should throw ConflictException if task already has solution', async () => {
      const taskWithSolution = { ...mockTask, solution: { id: 'existing-solution' } };
      taskRepo.findOne.mockResolvedValue(taskWithSolution);

      await expect(service.processAiCallback(mockTask.id, validPayload)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if task does not exist', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await expect(service.processAiCallback('non-existent-id', validPayload)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use custom cover page when user has one', async () => {
      mockCoversService.findByUser.mockResolvedValue({
        pdfUrl: '/uploads/covers/custom-cover.pdf',
      });

      await service.processAiCallback(mockTask.id, validPayload);

      expect(pdfService.generateSolutionPdf).toHaveBeenCalledWith(
        mockTask.title,
        validPayload.content,
        mockTask.id,
        validPayload.taskType,
        expect.any(Object),
        expect.stringContaining('custom-cover.pdf'),
        undefined, // planoDiapositivas
      );
    });
  });

  describe('countByUser', () => {
    it('should return task count for user', async () => {
      mockTaskRepo.count.mockResolvedValue(5);

      const result = await service.countByUser('user-uuid-123');

      expect(result).toBe(5);
      expect(taskRepo.count).toHaveBeenCalledWith({ where: { userId: 'user-uuid-123' } });
    });
  });

  describe('findById', () => {
    it('should return a task when found', async () => {
      taskRepo.findOne.mockResolvedValue(mockTask);

      const result = await service.findById(mockTask.id);

      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException when task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
