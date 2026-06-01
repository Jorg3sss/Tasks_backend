import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SignInDto {
  @IsNotEmpty({ message: 'El correo no puede estar vacío.' })
  @IsEmail({}, { message: 'Debe ser una dirección de email válida.' })
  correo: string;

  @IsNotEmpty({ message: 'La contraseña no puede estar vacía.' })
  @IsString()
  password: string;
}
