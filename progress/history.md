# Histórico de Tareas Completadas

> Última actualización: 2026-06-01 04:15 UTC

---

## 2026-06-01 — Harness Validation, Idempotency & Puppeteer

### F009 — DTO de validación estricta para respuesta de n8n
- **Agente:** developer
- **Estado:** completed
- **Archivos creados:**
  - `src/harness/dto/n8n-solution-response.dto.ts`
- **Descripción:** N8nSolutionResponseDto con class-validator para metadata_analisis, solucion_academica, plano_diapositivas

### F010 — Sistema de candados PROCESSING para idempotencia
- **Agente:** developer
- **Estado:** completed
- **Archivos modificados:**
  - `src/tasks/entities/task-status.enum.ts` — Añadido PROCESSING
  - `src/tasks/tasks.service.ts` — acquireProcessingLock(), releaseProcessingLock()
  - `src/calendar/calendar.service.ts` — Lock antes de enviar a n8n
  - `src/scheduler/scheduler.service.ts` — Lock antes de enviar a n8n
- **Descripción:** Previene llamadas duplicadas a Gemini bajo concurrencia

### F011 — HarnessModule con servicios de validación
- **Agente:** developer
- **Estado:** completed
- **Archivos creados:**
  - `src/harness/harness.module.ts`
  - `src/harness/solucion-validator.service.ts`
  - `src/harness/presentation-validator.service.ts`
- **Descripción:** Módulo global con validadores de solución y presentación

### F012 — Motor de presentaciones con Puppeteer
- **Agente:** developer
- **Estado:** completed
- **Archivos modificados:**
  - `src/tasks/pdf.service.ts` — generatePresentationPdf()
  - `package.json` — puppeteer-core instalado
- **Descripción:** Genera PDFs de presentación con Puppeteer, layouts dinámicos, CSS break-after:page

### Commits
- `bfd416c` — feat: harness validation, idempotency & Puppeteer presentation engine

---

## 2026-05-31 — Engineering Harness Setup

### F007 — Enum de TaskType extensible
- **Agente:** developer
- **Estado:** completed
- **Descripción:** DISCARDED añadido a TaskStatus, nuevos tipos en TaskType

### F008 — Engineering Harness completo
- **Agente:** developer
- **Estado:** completed
- **Descripción:** 13 agentes opencode, schemas JSON, health check, Jest, ESLint

### Commits
- `74131dc` — feat: engineering harness setup - 13 opencode agents, schemas, health check, tests

---

## 2026-05-22 — Features Core

### F002 — Integración con n8n + Gemini
- **Estado:** completed

### F003 — Generación de PDF con portada
- **Estado:** completed

### F004 — Enriquecimiento de documentos adjuntos
- **Estado:** completed

### F005 — Módulo de portadas personalizadas
- **Estado:** completed

---

## 2026-05-19 — Setup Inicial

### F001 — Sincronización de calendario Moodle
- **Estado:** completed

### F006 — Reintentos automáticos del scheduler
- **Estado:** completed
