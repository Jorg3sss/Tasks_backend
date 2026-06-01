import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task }          from './entities/task.entity';
import { Solution }      from './entities/solution.entity';
import { TasksService }  from './tasks.service';
import { TasksController } from './tasks.controller';
import { PdfService }    from './pdf.service';
import { ZipService }    from './zip.service';
import { AuthModule }    from '../auth/auth.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { MailModule }    from '../mail/mail.module';
import { CoversModule }  from '../covers/covers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Solution]),
    AuthModule,      // JwtAuthGuard + JwtService
    SubjectsModule,  // SubjectsService.findOrCreate()
    MailModule,      // MailService.sendTaskReadyEmail()
    CoversModule,    // CoversService.findByUser()
  ],
  providers:   [TasksService, PdfService, ZipService],
  controllers: [TasksController],
  exports:     [TasksService],
})
export class TasksModule {}
