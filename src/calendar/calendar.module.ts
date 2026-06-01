import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { User }           from '../users/entities/user.entity';
import { CalendarService }    from './calendar.service';
import { CalendarController } from './calendar.controller';
import { AuthModule }     from '../auth/auth.module';
import { TasksModule }    from '../tasks/tasks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AuthModule,
    TasksModule,   // Para usar TasksService.createFromCalendar()
  ],
  providers:   [CalendarService],
  controllers: [CalendarController],
})
export class CalendarModule {}
