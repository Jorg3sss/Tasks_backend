import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
export interface PublicUser {
    id: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    semestre: string;
    licenciatura: string;
    correo: string;
    calendarUrl: string | null;
}
export interface AuthResponse {
    accessToken: string;
    user: PublicUser;
}
export declare class AuthService {
    private readonly usersService;
    private readonly jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
    signUp(dto: SignUpDto): Promise<AuthResponse>;
    signIn(dto: SignInDto): Promise<AuthResponse>;
    private toPublicUser;
}
