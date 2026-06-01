# Backend Agents and Workflow Documentation

This document describes the automated processes (agents) and workflows within the Backend of the Homework Solution Platform.

> **⚠️ MANDATORY RULE FOR ALL AI AGENTS:**
> When making changes to this project (architecture, workflow, environment, APIs, etc.), you MUST update this `Agents.md` file to reflect the new state. This is the single source of truth for how the backend works. Failing to update this document after changes will lead to confusion and errors in future sessions.

## 1. Calendar Synchronization Workflow
Located in `CalendarService`, this workflow acts as the entry point for new tasks.

- **Process:**
    1. **Registration:** User provides a Moodle calendar URL (.ics).
    2. **Validation:** The service verifies if the URL is accessible.
    3. **Parsing:** Uses `node-ical` to parse the `.ics` file.
    4. **Attendance Detection:** Checks if the event is an attendance task (keywords: "asistencia", "pase de lista", "attendance", etc.). If so, marks it as `ATTENDANCE` type and skips AI processing.
    5. **Document Enrichment:** `DocumentParserService` scans the description for PDF/DOCX URLs, downloads them, and extracts text content to enrich the description.
    6. **Idempotency:** Checks if the task (by `externalEventId`) already exists.
    7. **Categorization:** Attempts to extract the subject name from the ICS categories.
    8. **Task Creation:** Persists the task in the database with a `PENDING` status.
    9. **AI Trigger:** Calls the n8n webhook with enriched task details to initiate analysis.

### Manual Sync Endpoint
- **Endpoint:** `POST /api/calendar/sync`
- **Auth:** JWT required
- **Behavior:** Re-downloads the user's registered `.ics` URL and creates any new tasks (idempotente por `externalEventId`). Returns count of new tasks.
- **Used by:** Dashboard "Actualizar" button.

## 2. n8n & Gemini Integration
The backend delegates the heavy lifting of content analysis and solution generation to an external n8n workflow.

### Workflow Architecture: SYNCHRONOUS (Current)

The n8n workflow uses a **synchronous** architecture. The backend sends a task to n8n, n8n calls Gemini, and **returns the solution directly in the HTTP response body**. The backend then processes the solution inline — no separate callback needed.

```
Backend → n8n webhook → Gemini → Parse → Respond with solution in HTTP body
         (POST)                              ↓
                                    Backend reads response.data
                                    and calls processAiCallback()
```

### Workflow Nodes: "TaskFlow — ICS Task Processor"

1. **Recibir Tarea del Backend** (Webhook)
   - Path: `ics-task-processor`
   - Method: `POST`
   - responseMode: `responseNode` (waits for explicit Respond node)

2. **Construir Prompt para Gemini** (Code Node)
   - Detects task type (CODE_SNIPPET, ESSAY, UML_DIAGRAM, etc.)
   - Builds optimized single prompt with all requirements
   - Outputs: `taskId`, `title`, `subjectName`, `tipoDetectado`, `prompt`

3. **Llamar Gemini API** (HTTP Request) ← **ONLY AI CALL**
   - Model: `gemini-2.5-flash` (primary) or Groq Llama (fallback)
   - Single request with complete task context
   - Temperature: 0.4, Max tokens: 8192
   - Timeout: 120s
   - **Rate Limit:** 20 requests/minute (Gemini free tier)

4. **Parsear Respuesta de Gemini** (Code Node)
   - Extracts: `TIPO`, `MATERIA`, `SOLUCION` from response
   - Validates task type against allowed values
   - Outputs: `taskId`, `subjectName`, `taskType`, `content`

5. **Responder al Backend** (Respond to Webhook)
   - Returns the parsed solution data as JSON in the HTTP response body
   - The calling service (CalendarService/SchedulerService/TasksService) reads `response.data` and calls `processAiCallback()` directly

### Outbound Payload (Backend → n8n)
```json
{
  "taskId": "uuid",
  "title": "Task title",
  "description": "Original description + enriched content from attached PDF/DOCX",
  "dueDate": "ISO 8601 date",
  "assignedDate": "ISO 8601 date",
  "subjectName": "Subject name from ICS categories"
}
```
- **Headers:** `Content-Type: application/json`, `x-webhook-secret: <N8N_SECRET_KEY>`
- **Webhook URL (Local):** `http://165.245.148.89:5678/webhook/ics-task-processor`
- **Webhook URL (Production):** `http://n8n:5678/webhook/ics-task-processor`
- **Timeout:** 120s (all services)

### Response Payload (n8n → Backend, in HTTP response body)
```json
{
  "taskId": "uuid",
  "content": "Markdown solution content",
  "subjectName": "Resolved subject name",
  "taskType": "ESSAY|CODE_SNIPPET|UML_DIAGRAM|PRESENTATION|READING|EXAM|ATTENDANCE|OTHER"
}
```

### Legacy Webhook Endpoint (still available as fallback)
- **Endpoint:** `POST /api/webhooks/n8n/task-solution/:taskId`
- **Headers:** `x-webhook-secret: <N8N_SECRET_KEY>`
- **Used by:** WebhooksController — can be re-enabled if workflow is switched back to async

### Rate Limit Optimization
- **Single prompt per task:** All analysis + solution in one call
- **Scheduler delay:** 5 seconds between tasks (DELAY_BETWEEN_MS)
- **Max batch:** 1 task per scheduler cycle (MAX_BATCH)
- **Retry interval:** 10 minutes (RETRY_INTERVAL_MS)
- **Only PENDING tasks:** Tasks with solutions are never re-sent

## 3. Document Parser Agent
Located in `DocumentParserService` (global module: `CommonModule`), this agent enriches task descriptions by extracting text from attached documents.

- **Detection:** Scans task description for URLs ending in `.pdf` or `.docx`
- **PDF Parsing:** Uses `pdf-parse` library to extract text from PDF files
- **DOCX Parsing:** Uses `mammoth` library to extract raw text from Word documents
- **Enrichment:** Appends extracted content to original description with markers:
  ```
  --- Contenido del archivo DOCX (https://...) ---
  [extracted text content]
  --- Fin del archivo ---
  ```
- **Error Handling:** Continues processing if a document fails to parse (logs warning)
- **Used by:** CalendarService, TasksService.requestSolution, SchedulerService

## 4. Solution Processing Agent
The `TasksService.processAiCallback` method orchestrates the finalization of a task once the AI has responded.

- **Steps:**
    1. **Subject Resolution:** If n8n identifies a subject, it's matched or created via `SubjectsService`.
    2. **Status Update:** Task status changes to `COMPLETED`.
    3. **Cover Page Lookup:** Checks if the user has a custom cover page via `CoversService.findByUser()`.
    4. **PDF Generation:** `PdfService` creates a professional document. If the user has a custom cover page PDF, it's merged as the first page using `pdf-lib`. Otherwise, a default cover is generated with PDFKit.
    5. **Code Extraction:** If the task is a `CODE_SNIPPET`, `ZipService` creates a downloadable ZIP from the markdown content.
    6. **Persistence:** Saves the `Solution` entity linked to the `Task`.
    7. **Notification:** `MailService` sends an automated email to the student with the PDF link.

## 5. Manual Request Agent
Users can manually trigger a solution generation for tasks that were not automatically processed (e.g., `OVERDUE` or `SUBMITTED` tasks).

- **Service:** `TasksService.requestSolution`
- **Validation:** Ensures no solution exists before queueing a new request to n8n.
- **Document Enrichment:** Enriches description with PDF/DOCX content before sending to n8n.

## 6. Scheduler Agent
Located in `SchedulerService`, runs automatically on module init and every 10 minutes.

- **Process:** Finds PENDING tasks without solutions, sends them to n8n one at a time.
- **Document Enrichment:** Enriches descriptions with PDF/DOCX content before sending.
- **Rate Limit:** 5s delay between tasks, max 1 task per cycle.

## 7. Cover Page Module
Located in `src/covers/`, manages user cover pages for task PDFs.

### Entity: `CoverPage`
- `id` (UUID), `pdfUrl` (varchar), `isCustom` (boolean), `userId` (UUID)
- Relation: ManyToOne with User

### Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/covers` | Get user's active cover page |
| `POST` | `/api/covers/upload` | Upload custom PDF (multipart, max 10MB) |
| `POST` | `/api/covers/generate` | Generate AI cover page using user profile data |
| `DELETE` | `/api/covers` | Delete user's cover page |

### Storage
- Files stored in `public/uploads/covers/`
- Served via `ServeStaticModule` at `/uploads/covers/`

## 8. Attendance Filtering
Tasks identified as attendance (keywords in title/description) are automatically:
- Typed as `ATTENDANCE` (new enum value in `TaskType`)
- **Not sent to n8n** — no AI processing needed
- Created in DB for tracking purposes only

### Keywords detected
`asistencia`, `pase de lista`, `pases de lista`, `lista de asistencia`, `attendance`, `check-in`, `check in`, `firma`, `pase lista`

## Key Entities
- **Task:** Represents a homework assignment (Title, Status, Type, Dates).
- **Solution:** Contains the Markdown result, PDF URL, and optional ZIP URL.
- **Subject:** Categorizes tasks.
- **User:** Stores student profile, calendar settings, and cover pages.
- **CoverPage:** Stores user's cover page PDF (custom or AI-generated).

## 9. Environment Configuration

### Local Development vs Production

The backend uses different `.env` configurations depending on the environment:

#### Local Development
- **Database:** Connects via SSH tunnel to remote VPS
  ```
  DB_HOST=127.0.0.1
  DB_PORT=5432
  ```
  - Tunnel command: `ssh -L 5432:localhost:5432 root@165.245.148.89`
  - **Never expose database publicly** - always use SSH tunnel

- **n8n Webhook:** Points to VPS n8n instance
  ```
  N8N_WEBHOOK_URL=http://165.245.148.89:5678/webhook/ics-task-processor
  ```

- **App Base URL:** VPS backend URL (for email links)
  ```
  APP_BASE_URL=http://165.245.148.89:3001
  ```

- **CORS Origins:** Includes both local and VPS
  ```
  CORS_ORIGINS=http://165.245.148.89:3000,http://165.245.148.89:3001,http://localhost:3000,http://localhost:3001
  ```

#### Production (VPS)
- **Database:** Connects to local PostgreSQL container
  ```
  DB_HOST=postgres
  DB_PORT=5432
  ```

- **n8n Webhook:** Points to local n8n container
  ```
  N8N_WEBHOOK_URL=http://n8n:5678/webhook/ics-task-processor
  ```

### Important Notes
- **Database Security:** The PostgreSQL database is **never exposed publicly**. Local development always uses SSH tunnel. Production uses Docker internal network.
- **n8n Communication:** Local backend calls n8n on VPS via public IP. Production backend calls n8n via Docker internal network (`http://n8n:5678`).

## 10. Module Structure

```
src/
├── app.module.ts          # Root module, registers all modules
├── main.ts                # Bootstrap, CORS, validation pipe, global prefix /api
├── auth/                  # JWT authentication, login/register
├── calendar/              # Calendar sync, .ics parsing, n8n trigger
├── common/                # SharedModule: DocumentParserService, guards, decorators
│   ├── common.module.ts   # @Global module
│   └── document-parser.service.ts
├── covers/                # Cover page management
│   ├── covers.module.ts
│   ├── covers.service.ts
│   ├── covers.controller.ts
│   └── entities/cover-page.entity.ts
├── mail/                  # Email notifications (SMTP Gmail)
├── scheduler/             # Auto-retry PENDING tasks every 10 min
├── subjects/              # Subject CRUD + findOrCreate
├── tasks/                 # Task CRUD, PDF generation, ZIP generation
│   ├── tasks.module.ts
│   ├── tasks.service.ts   # processAiCallback, requestSolution, createFromCalendar
│   ├── tasks.controller.ts
│   ├── pdf.service.ts     # PDFKit + pdf-lib for cover merging
│   ├── zip.service.ts
│   └── entities/          # Task, Solution, TaskType, TaskStatus
├── users/                 # User CRUD, profile management
└── webhooks/              # Legacy n8n callback endpoint
```

## 11. Installed Dependencies (added)

| Package | Purpose |
|---------|---------|
| `pdf-lib` | Merge custom cover page PDFs with generated content |
| `pdf-parse` | Extract text from PDF documents (task descriptions) |
| `mammoth` | Extract text from DOCX documents (task descriptions) |
| `@types/multer` | TypeScript types for file uploads |

## 12. Mandatory Rules
- **No hardcoded secrets:** Always use `.env` files.
- **Webhook Security:** All webhook endpoints must validate the `N8N_SECRET_KEY` header.
- **Audit Logs:** Every API request to external AI models must be logged.
- **Document Enrichment:** All paths that send tasks to n8n (CalendarService, requestSolution, SchedulerService) must enrich descriptions with DocumentParserService.

## 13. Engineering Harness

Sistema de 13 subagentes opencode orquestados por el Leader para automatizar desarrollo, verificación, despliegue y mantenimiento del proyecto.

### Agentes

| # | Agente | Archivo | Rol |
|---|--------|---------|-----|
| 1 | **leader** | `.opencode/agents/leader.md` | Orquestador principal. Evalúa complejidad, asigna agentes, aprueba acciones SSH |
| 2 | **reviewer** | `.opencode/agents/reviewer.md` | Revisa código contra reglas, ejecuta lint/build, escribe feedback |
| 3 | **explorer** | `.opencode/agents/explorer.md` | Investiga código, busca patrones, encuentra dependencias |
| 4 | **developer** | `.opencode/agents/developer.md` | Implementa código, modifica archivos directamente, crea features |
| 5 | **security** | `.opencode/agents/security.md` | Audita secrets, vulnerabilidades, configuración, CORS, inyección |
| 6 | **server-ssh** | `.opencode/agents/server-ssh.md` | SSH al VPS: verificar servicios, puertos, logs, deploy (con confirmación) |
| 7 | **test** | `.opencode/agents/test.md` | Genera y ejecuta tests unitarios/e2e, reporta cobertura |
| 8 | **integration** | `.opencode/agents/integration.md` | Debug de llamadas a n8n, Gemini, SMTP, .ics |
| 9 | **document** | `.opencode/agents/document.md` | Maneja pipeline PDF/DOCX (PDFKit, pdf-lib, mammoth, pdf-parse) |
| 10 | **environment** | `.opencode/agents/environment.md` | Valida .env, Docker, SSH tunnel, diferencia local/prod |
| 11 | **migration** | `.opencode/agents/migration.md` | Genera migraciones TypeORM, maneja rollback, valida SQL |
| 12 | **documentation** | `.opencode/agents/documentation.md` | Escribe README, documenta módulos, genera docs en markdown |
| 13 | **database** | `.opencode/agents/database.md` | Diseña tablas, optimiza queries, normalización, índices |

### Comunicación entre Agentes
Los subagentes SIEMPRE escriben resultados completos en `progress/[nombre-agente].md`. NUNCA resumen en el chat. Esto evita el problema del "teléfono descompuesto" donde la información se pierde al pasar entre agentes.

### Archivos de Progress
| Archivo | Propósito | Quién escribe |
|---------|-----------|---------------|
| `progress/currents.md` | Estado actual, última tarea | Leader |
| `progress/review.md` | Feedback del reviewer | Reviewer |
| `progress/history.md` | Histórico de tareas completadas | Leader (append) |
| `progress/errors.md` | Errores y soluciones | Cualquier agente |
| `progress/explorer.md` | Resultados de investigación | Explorer |
| `progress/developer.md` | Código implementado | Developer |
| `progress/test.md` | Resultados de tests | Test |
| `progress/security.md` | Hallazgos de seguridad | Security |
| `progress/server-ssh.md` | Estado del servidor | Server-SSH |
| `progress/ssh-actions.md` | Acciones SSH ejecutadas | Server-SSH |

### Schemas JSON
| Schema | Propósito |
|--------|-----------|
| `schemas/n8n-task-outbound.schema.json` | Payload Backend → n8n |
| `schemas/n8n-solution-response.schema.json` | Respuesta n8n → Backend |
| `schemas/task-assignment.schema.json` | Asignación Leader → Subagente |
| `schemas/agent-response.schema.json` | Respuesta Subagente → Leader |

### Configuración
- **opencode.json:** `.opencode/opencode.json` — Configuración de agentes y reglas
- **feature_list.json:** Lista de features con estado y prioridad

## 14. Reglas Duras del Harness

| ID | Regla | Categoría |
|----|-------|-----------|
| R001 | Nunca hardcodear secrets — siempre usar `.env` | security |
| R002 | Enriquecer descripciones antes de enviar a n8n (DocumentParserService) | workflow |
| R003 | Lanzar reviewer después de cada implementación | workflow |
| R004 | Crear rama nueva + commit (`feat:`/`fix:`/`chore:`) por cada cambio de código. Push a `https://github.com/Jorg3sss/Tasks_backend.git` | workflow |
| R005 | No empezar NADA si health-check falla — arreglar primero | workflow |
| R006 | Verificar SSH tunnel activo antes de conectar a BD local | environment |
| R007 | Cifrar contraseñas (bcrypt), no exponer datos sensibles en logs | security |
| R008 | Tareas de Moodle sin valor (pase de lista, "sube un video") → `DISCARDED`, no enviar a n8n | workflow |
| R009 | Seguir estructura del proyecto existente (ver sección 10) | architecture |
| R010 | Ejecutar tests y code review antes de marcar COMPLETED | workflow |
| R011 | Usar variables `.env` — nunca hardcodear valores | security |
| R012 | Ejecutar verificación de seguridad en cada cambio | security |
| R013 | Seguir feedback de security — si hay issues, crear features en `feature_list.json` | security |
| R014 | Guardar todos los logs en `logs/` y `progress/` | workflow |
| R015 | Subagentes escriben resultados en archivos, NO en chat (anti-teléfono-descompuesto) | workflow |

## 15. Estados de Tarea

| Estado | Significado |
|--------|-------------|
| `pending` | Nadie asignado aún |
| `in_progress` | Agente trabajando en ella |
| `review` | Esperando revisión del reviewer |
| `completed` | Terminada y aprobada |
| `blocked` | No se puede avanzar (dependencia o error) |
| `discarded` | Tarea sin valor (pase de lista, "sube un video", etc.) |

## 16. Protocolo de Desbloqueo

Si un agente se bloquea:
1. Leer `progress/errors.md` por errores previos similares
2. Leer `Agents.md` sección relevante
3. Usar `explorer` para investigar código relacionado
4. Si es problema de servidor → usar `server-ssh` para diagnosticar
5. Si persiste → escribir en `progress/errors.md` y escalar al usuario

## 17. Git Workflow

Por cada cambio de código:
1. Crear rama: `git checkout -b feat/nombre-feature`
2. Implementar cambios
3. Commit: `git commit -m "feat: descripción breve"`
4. Push: `git push origin feat/nombre-feature`

### Prefijos de Commit
- `feat:` — Nueva feature
- `fix:` — Bug fix
- `chore:` — Mantenimiento
- `docs:` — Documentación
- `test:` — Tests
- `refactor:` — Refactorización
- `style:` — Formato/estilo
- `perf:` — Performance

## 18. Anti-Teléfono-Descompuesto

### Regla Absoluta
Los subagentes NUNCA resumen resultados en el chat. SIEMPRE escriben resultados completos en archivos.

### Flujo Obligatorio
1. Agente escribe resultado COMPLETO en `progress/[nombre].md`
2. Siguiente agente LEE el archivo directamente (no recibe resumen del leader)
3. Si un agente no entiende algo → lee el archivo directamente → NO pregunta al leader

### Ejemplo Correcto
```
Explorer escribe en progress/explorer.md:
"En tasks.service.ts:142, processAiCallback usa WebhookSolutionDto 
con campos: content, subjectName, taskType. El campo content se guarda 
como contenidoMarkdown en Solution.entity:18"

Developer LEE progress/explorer.md → implementa basándose en el archivo
```

### Ejemplo Incorrecto (Teléfono Descompuesto)
```
Explorer le dice al leader: "El schema necesita content, subjectName y taskType"
Leader le dice al developer: "Usa content, subjectName y taskType"
Developer no sabe de dónde vienen ni el contexto exacto
```

## 19. Filtro de Tareas DISCARDED

Tareas de Moodle que no requieren procesamiento IA se marcan como `DISCARDED`:
- Pase de lista / asistencia (ya manejado como `ATTENDANCE`)
- "Sube un video como entrega"
- "Firma electrónica"
- Tareas sin instrucciones claras
- Tareas repetidas o de prueba

Estas tareas se crean en BD para tracking pero NO se envían a n8n.
