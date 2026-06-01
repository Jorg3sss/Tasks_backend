import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
export interface UpdateProfileDto {
    nombres?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    semestre?: string;
    licenciatura?: string;
}
export declare class UsersService {
    private readonly usersRepository;
    constructor(usersRepository: Repository<User>);
    findByEmail(correo: string): Promise<User | null>;
    findById(id: string): Promise<User>;
    create(userData: Partial<User>): Promise<User>;
    updateProfile(userId: string, dto: UpdateProfileDto): Promise<Omit<User, 'password'>>;
}
