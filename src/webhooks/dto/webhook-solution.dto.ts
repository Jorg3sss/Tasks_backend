import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TaskType } from '../../tasks/entities/task-type.enum';

/**
 * Payload que n8n envía al backend una vez que Gemini termina de procesar la tarea.
 *
 * Ejemplo de body desde n8n:
 * {
 *   "content":     "# Solución\n\nLos límites son...",
 *   "subjectName": "Cálculo Diferencial",
 *   "taskType":    "ESSAY",
 *   "userEmail":   "alumno@ejemplo.com"
 * }
 */
export class WebhookSolutionDto {
  /** Respuesta completa de Gemini en formato Markdown. */
  @IsNotEmpty({ message: 'El contenido de la solución es obligatorio.' })
  @IsString()
  content: string;

  /**
   * Nombre de la asignatura deducida por Gemini.
   * Envía "DESCONOCIDA" si no se puede determinar.
   */
  @IsNotEmpty({ message: 'El nombre de la asignatura es obligatorio.' })
  @IsString()
  subjectName: string;

  /** Tipo de tarea clasificado por Gemini. */
  @IsEnum(TaskType, {
    message: `taskType debe ser uno de: ${Object.values(TaskType).join(', ')}`,
  })
  taskType: TaskType;

  /** Correo del alumno — opcional; se obtiene de task.user.correo en el backend. */
  @IsOptional()
  @IsString()
  userEmail?: string;
}
