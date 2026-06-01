import {
  Controller, Get, Patch, Body, UseGuards,
} from '@nestjs/common';
import { UsersService, UpdateProfileDto } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser }      from '../common/decorators/get-user.decorator';
import {
  IsString, IsOptional, Length,
} from 'class-validator';

class PatchProfileDto implements UpdateProfileDto {
  @IsOptional() @IsString() @Length(1, 120) nombres?:         string;
  @IsOptional() @IsString() @Length(1, 80)  apellidoPaterno?: string;
  @IsOptional() @IsString() @Length(1, 80)  apellidoMaterno?: string;
  @IsOptional() @IsString() @Length(1, 20)  semestre?:        string;
  @IsOptional() @IsString() @Length(1, 120) licenciatura?:    string;
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** GET /users/me — datos públicos del usuario autenticado */
  @Get('me')
  getMe(@GetUser('sub') userId: string) {
    return this.usersService.findById(userId).then(({ password: _, ...u }) => u);
  }

  /** PATCH /users/profile — actualiza nombre, semestre, etc. */
  @Patch('profile')
  updateProfile(
    @GetUser('sub') userId: string,
    @Body() dto: PatchProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }
}
