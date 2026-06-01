import { Module }       from '@nestjs/common';
import { TasksModule }  from '../tasks/tasks.module';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports:     [TasksModule],   // expone TasksService
  controllers: [WebhooksController],
})
export class WebhooksModule {}
