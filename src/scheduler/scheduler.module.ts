import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task }          from '../tasks/entities/task.entity';
import { SchedulerService } from './scheduler.service';
import { TasksModule }   from '../tasks/tasks.module';

@Module({
  imports:   [TypeOrmModule.forFeature([Task]), forwardRef(() => TasksModule)],
  providers: [SchedulerService],
  exports:   [SchedulerService],
})
export class SchedulerModule {}
