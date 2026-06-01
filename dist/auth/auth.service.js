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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const users_service_1 = require("../users/users.service");
const SALT_ROUNDS = 10;
let AuthService = class AuthService {
    constructor(usersService, jwtService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
    }
    async signUp(dto) {
        const exists = await this.usersService.findByEmail(dto.correo);
        if (exists)
            throw new common_1.ConflictException('El correo ya está en uso.');
        const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
        const newUser = await this.usersService.create({
            nombres: dto.nombres,
            apellidoPaterno: dto.apellidoPaterno,
            apellidoMaterno: dto.apellidoMaterno,
            semestre: dto.semestre,
            licenciatura: dto.licenciatura,
            correo: dto.correo,
            password: hashedPassword,
        });
        const payload = { sub: newUser.id, correo: newUser.correo };
        const accessToken = await this.jwtService.signAsync(payload);
        return { accessToken, user: this.toPublicUser(newUser) };
    }
    async signIn(dto) {
        const user = await this.usersService.findByEmail(dto.correo);
        if (!user)
            throw new common_1.UnauthorizedException('Credenciales inválidas.');
        const passwordMatch = await bcrypt.compare(dto.password, user.password);
        if (!passwordMatch)
            throw new common_1.UnauthorizedException('Credenciales inválidas.');
        const payload = { sub: user.id, correo: user.correo };
        const accessToken = await this.jwtService.signAsync(payload);
        return { accessToken, user: this.toPublicUser(user) };
    }
    toPublicUser(user) {
        return {
            id: user.id,
            nombres: user.nombres,
            apellidoPaterno: user.apellidoPaterno,
            apellidoMaterno: user.apellidoMaterno,
            semestre: user.semestre,
            licenciatura: user.licenciatura,
            correo: user.correo,
            calendarUrl: user.calendarUrl ?? null,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map