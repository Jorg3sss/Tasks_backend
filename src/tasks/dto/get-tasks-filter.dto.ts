import { IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { TaskStatus } from '../entities/task-status.enum';
import { TaskType }   from '../entities/task-type.enum';

export class GetTasksFilterDto {
  @IsOptional()
  @IsEnum(TaskStatus, { message: 'status debe ser PENDING, SUBMITTED u OVERDUE.' })
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  /** Fecha ISO (YYYY-MM-DD). Filtra tareas con dueDate >= from */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Fecha ISO (YYYY-MM-DD). Filtra tareas con dueDate <= to */
  @IsOptional()
  @IsDateString()
  to?: string;
}
