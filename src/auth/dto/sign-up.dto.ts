import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';

/**
 * Semestres válidos expresados con letras (rechaza dígitos).
 */
const SEMESTRES_VALIDOS = [
  'primero',
  'segundo',
  'tercero',
  'cuarto',
  'quinto',
  'sexto',
  'séptimo',
  'septimo',
  'octavo',
  'noveno',
  'décimo',
  'onceavo',
] as const;

export class SignUpDto {
  /**
   * Solo letras (incluyendo acentos y ñ) y espacios. Sin números.
   */
  @IsNotEmpty({ message: 'El nombre no puede estar vacío.' })
  @IsString()
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
    message: 'El nombre solo puede contener letras y espacios (sin números ni caracteres especiales).',
  })
  nombres: string;

  @IsNotEmpty({ message: 'Este campo no puede estar vacío.' })
  @IsString()
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
    message: 'Este campo solo puede contener letras y espacios (sin números ni caracteres especiales).',
  })
  apellidoPaterno: string;

  @IsNotEmpty({ message: 'Este campo no no puede estar vacío.' })
  @IsString()
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
    message: 'Este campo solo puede contener letras y espacios (sin números ni caracteres especiales).',
  })
  apellidoMaterno: string;

  /**
   * Debe ser una de las palabras de SEMESTRES_VALIDOS.
   * Rechaza cualquier número o valor fuera de la lista.
   */
  @IsNotEmpty({ message: 'El campo semestre no puede estar vacío.' })
  @IsString()
  @IsIn(SEMESTRES_VALIDOS, {
    message: `El semestre debe escribirse con letras. Valores aceptados: ${SEMESTRES_VALIDOS.join(', ')}.`,
  })
  semestre: string;

  @IsNotEmpty({ message: 'El campo licenciatura no puede estar vacío.' })
  @IsString()
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
    message: 'Este campo solo puede contener letras y espacios (sin números ni caracteres especiales).',
  })
  licenciatura: string;

  @IsNotEmpty({ message: 'El campo correo no puede estar vacío.' })
  @IsEmail({}, { message: 'El correo debe ser una dirección de email válida.' })
  correo: string;

  /**
   * Mínimo 8 caracteres.
   * Al menos: 1 mayúscula, 1 minúscula, 1 dígito y 1 carácter especial.
   */
  @IsNotEmpty({ message: 'La contraseña no puede estar vacía.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{8,}$/, {
    message:
      'La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&_-#).',
  })
  password: string;
}
