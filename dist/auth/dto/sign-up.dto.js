"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignUpDto = void 0;
const class_validator_1 = require("class-validator");
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
];
class SignUpDto {
}
exports.SignUpDto = SignUpDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El nombre no puede estar vacío.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
        message: 'El nombre solo puede contener letras y espacios (sin números ni caracteres especiales).',
    }),
    __metadata("design:type", String)
], SignUpDto.prototype, "nombres", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Este campo no puede estar vacío.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
        message: 'Este campo solo puede contener letras y espacios (sin números ni caracteres especiales).',
    }),
    __metadata("design:type", String)
], SignUpDto.prototype, "apellidoPaterno", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Este campo no no puede estar vacío.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
        message: 'Este campo solo puede contener letras y espacios (sin números ni caracteres especiales).',
    }),
    __metadata("design:type", String)
], SignUpDto.prototype, "apellidoMaterno", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El campo semestre no puede estar vacío.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(SEMESTRES_VALIDOS, {
        message: `El semestre debe escribirse con letras. Valores aceptados: ${SEMESTRES_VALIDOS.join(', ')}.`,
    }),
    __metadata("design:type", String)
], SignUpDto.prototype, "semestre", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El campo licenciatura no puede estar vacío.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
        message: 'Este campo solo puede contener letras y espacios (sin números ni caracteres especiales).',
    }),
    __metadata("design:type", String)
], SignUpDto.prototype, "licenciatura", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El campo correo no puede estar vacío.' }),
    (0, class_validator_1.IsEmail)({}, { message: 'El correo debe ser una dirección de email válida.' }),
    __metadata("design:type", String)
], SignUpDto.prototype, "correo", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'La contraseña no puede estar vacía.' }),
    (0, class_validator_1.Matches)(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{8,}$/, {
        message: 'La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&_-#).',
    }),
    __metadata("design:type", String)
], SignUpDto.prototype, "password", void 0);
//# sourceMappingURL=sign-up.dto.js.map