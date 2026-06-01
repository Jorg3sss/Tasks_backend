export enum TaskStatus {
  PENDING    = 'PENDING',    // Tarea creada, sin solución IA
  PROCESSING = 'PROCESSING', // Enviada a n8n/Gemini, esperando respuesta (candado anti-duplicados)
  SUBMITTED  = 'SUBMITTED',  // Entregada manualmente por el alumno
  OVERDUE    = 'OVERDUE',    // Vencida sin entregar
  COMPLETED  = 'COMPLETED',  // Solución IA generada y PDF listo
  DISCARDED  = 'DISCARDED',  // Tarea sin valor (pase de lista, "sube un video", etc.)
}
