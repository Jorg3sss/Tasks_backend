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
