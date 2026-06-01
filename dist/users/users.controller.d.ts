import { UsersService, UpdateProfileDto } from './users.service';
declare class PatchProfileDto implements UpdateProfileDto {
    nombres?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    semestre?: string;
    licenciatura?: string;
}
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMe(userId: string): Promise<{
        id: string;
        nombres: string;
        apellidoPaterno: string;
        apellidoMaterno: string;
        semestre: string;
        licenciatura: string;
        correo: string;
        calendarUrl: string | null;
        userSubjects: import("../subjects/entities/user-subject.entity").UserSubject[];
        tasks: import("../tasks/entities/task.entity").Task[];
        coverPages: import("../covers/entities/cover-page.entity").CoverPage[];
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateProfile(userId: string, dto: PatchProfileDto): Promise<Omit<import("./entities/user.entity").User, "password">>;
}
export {};
