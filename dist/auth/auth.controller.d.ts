import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    signUp(dto: SignUpDto): Promise<import("./auth.service").AuthResponse>;
    signIn(dto: SignInDto): Promise<import("./auth.service").AuthResponse>;
}
