export enum TaskStatus {
  PENDING   = 'PENDING',    // Tarea creada, sin solución IA
  SUBMITTED = 'SUBMITTED',  // Entregada manualmente por el alumno
  OVERDUE   = 'OVERDUE',    // Vencida sin entregar
  COMPLETED = 'COMPLETED',  // Solución IA generada y PDF listo
  DISCARDED = 'DISCARDED',  // Tarea sin valor (pase de lista, "sube un video", etc.)
}
