import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoverPage } from './entities/cover-page.entity';
import { User } from '../users/entities/user.entity';
import { CoversService } from './covers.service';
import { CoversController } from './covers.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CoverPage, User]),
    AuthModule,
  ],
  providers: [CoversService],
  controllers: [CoversController],
  exports: [CoversService],
})
export class CoversModule {}
