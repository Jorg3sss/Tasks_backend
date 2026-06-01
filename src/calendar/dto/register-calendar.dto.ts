import { IsNotEmpty, IsUrl } from 'class-validator';

export class RegisterCalendarDto {
  @IsNotEmpty({ message: 'La URL del calendario no puede estar vacía.' })
  @IsUrl({}, { message: 'La URL del calendario no es válida. Debe ser una URL pública (.ics).' })
  calendarUrl: string;
}
