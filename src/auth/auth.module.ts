import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule }     from '@nestjs/jwt';
import { UsersModule }   from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService }    from './auth.service';
import { JwtAuthGuard }   from './guards/jwt-auth.guard';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:       config.get<string>('JWT_SECRET'),
        signOptions:  { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers:   [AuthService, JwtAuthGuard],
  exports:     [AuthService, JwtAuthGuard, JwtModule], // JwtModule exportado para que el guard funcione en otros módulos
})
export class AuthModule {}
