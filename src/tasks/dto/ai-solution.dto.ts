import { IsNotEmpty, IsString } from 'class-validator';

/** Payload que envía n8n/Gemini al endpoint webhook de solución. */
export class AiSolutionDto {
  @IsNotEmpty({ message: 'El contenido de la solución no puede estar vacío.' })
  @IsString()
  content: string;
}
