import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SignUpDto }    from './dto/sign-up.dto';
import { SignInDto }    from './dto/sign-in.dto';

const SALT_ROUNDS = 10;

/** Datos del usuario expuestos al cliente (sin password ni timestamps). */
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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // ── Registro ──────────────────────────────────────────────────────

  async signUp(dto: SignUpDto): Promise<AuthResponse> {
    const exists = await this.usersService.findByEmail(dto.correo);
    if (exists) throw new ConflictException('El correo ya está en uso.');

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

    const payload     = { sub: newUser.id, correo: newUser.correo };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken, user: this.toPublicUser(newUser) };
  }

  // ── Login ─────────────────────────────────────────────────────────

  async signIn(dto: SignInDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.correo);
    if (!user) throw new UnauthorizedException('Credenciales inválidas.');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Credenciales inválidas.');

    const payload     = { sub: user.id, correo: user.correo };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken, user: this.toPublicUser(user) };
  }

  // ── Helper ────────────────────────────────────────────────────────

  private toPublicUser(user: any): PublicUser {
    return {
      id:               user.id,
      nombres:          user.nombres,
      apellidoPaterno:  user.apellidoPaterno,
      apellidoMaterno:  user.apellidoMaterno,
      semestre:         user.semestre,
      licenciatura:     user.licenciatura,
      correo:           user.correo,
      calendarUrl:      user.calendarUrl ?? null,
    };
  }
}
