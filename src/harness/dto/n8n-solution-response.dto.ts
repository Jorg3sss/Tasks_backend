import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskType } from '../../tasks/entities/task-type.enum';

// ── Sub-DTOs ──────────────────────────────────────────────────────

export class RequisitosFormatoDto {
  @IsOptional()
  @IsString()
  fuente?: string;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(24)
  tamano_fuente?: number;

  @IsOptional()
  @IsString()
  extension_esperada?: string;
}

export class MetadataAnalisisDto {
  @IsNotEmpty({ message: 'taskType es obligatorio dentro de metadata_analisis.' })
  @IsEnum(TaskType, {
    message: `taskType debe ser uno de: ${Object.values(TaskType).join(', ')}`,
  })
  taskType!: TaskType;

  @IsOptional()
  @ValidateNested()
  @Type(() => RequisitosFormatoDto)
  requisitos_formato?: RequisitosFormatoDto;
}

export class SolucionAcademicaDto {
  @IsNotEmpty({ message: 'titulo es obligatorio dentro de solucion_academica.' })
  @IsString()
  titulo!: string;

  @IsNotEmpty({ message: 'desarrollo_markdown es obligatorio dentro de solucion_academica.' })
  @IsString()
  desarrollo_markdown!: string;
}

// ── Slide DTO ─────────────────────────────────────────────────────

export class SlideDto {
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  num_slide!: number;

  @IsNotEmpty()
  @IsEnum(['titulo_centrado', 'dos_columnas', 'lista_bullets'], {
    message: 'layout debe ser: titulo_centrado, dos_columnas o lista_bullets',
  })
  layout!: 'titulo_centrado' | 'dos_columnas' | 'lista_bullets';

  @IsNotEmpty()
  @IsString()
  titulo!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'contenido debe tener al menos un elemento.' })
  @IsString({ each: true })
  contenido!: string[];

  @IsOptional()
  @IsString()
  notas_orador?: string;
}

export class PlanoDiapositivasDto {
  @IsNotEmpty()
  @IsEnum(['minimal_light', 'minimal_dark'], {
    message: 'estilo_visual debe ser: minimal_light o minimal_dark',
  })
  estilo_visual!: 'minimal_light' | 'minimal_dark';

  @IsArray()
  @ArrayMinSize(1, { message: 'slides debe tener al menos una diapositiva.' })
  @ValidateNested({ each: true })
  @Type(() => SlideDto)
  slides!: SlideDto[];
}

// ── DTO Principal ─────────────────────────────────────────────────

/**
 * Estructura de respuesta completa que n8n/Gemini debe devolver al backend.
 *
 * Ejemplo:
 * {
 *   "metadata_analisis": {
 *     "taskType": "ESSAY",
 *     "requisitos_formato": { "fuente": "Arial", "tamano_fuente": 12, "extension_esperada": ".pdf" }
 *   },
 *   "solucion_academica": {
 *     "titulo": "Ensayo sobre la Revolución Mexicana",
 *     "desarrollo_markdown": "# Introducción\n\n..."
 *   },
 *   "plano_diapositivas": null
 * }
 */
export class N8nSolutionResponseDto {
  @IsNotEmpty({ message: 'metadata_analisis es obligatorio.' })
  @ValidateNested()
  @Type(() => MetadataAnalisisDto)
  metadata_analisis!: MetadataAnalisisDto;

  @IsNotEmpty({ message: 'solucion_academica es obligatorio.' })
  @ValidateNested()
  @Type(() => SolucionAcademicaDto)
  solucion_academica!: SolucionAcademicaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlanoDiapositivasDto)
  plano_diapositivas?: PlanoDiapositivasDto | null;
}
