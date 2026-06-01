import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSubjectDto {
  @IsNotEmpty({ message: 'El nombre de la asignatura no puede estar vacío.' })
  @IsString()
  @MaxLength(160)
  name: string;
}
