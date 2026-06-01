import { Module }        from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join }          from 'path';

import { AuthModule }      from './auth/auth.module';
import { UsersModule }     from './users/users.module';
import { SubjectsModule }  from './subjects/subjects.module';
import { TasksModule }     from './tasks/tasks.module';
import { CalendarModule }  from './calendar/calendar.module';
import { MailModule }      from './mail/mail.module';
import { WebhooksModule }  from './webhooks/webhooks.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { CoversModule }    from './covers/covers.module';
import { CommonModule }    from './common/common.module';
import { HarnessModule }    from './harness/harness.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    CommonModule,
    HarnessModule,

    // Sirve ./public en / — los PDFs quedan en /uploads/pdfs/
    ServeStaticModule.forRoot({
      rootPath:  join(process.cwd(), 'public'),
      serveRoot: '/',
      exclude:   ['/api/(.*)'],
    }),

    TypeOrmModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (c: ConfigService) => ({
        type:             'postgres',
        host:             c.get<string>('DB_HOST'),
        port:             c.get<number>('DB_PORT'),
        username:         c.get<string>('DB_USER'),
        password:         c.get<string>('DB_PASS'),
        database:         c.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize:      true,
      }),
    }),

    // Dominio
    AuthModule,
    UsersModule,
    SubjectsModule,
    TasksModule,
    CalendarModule,
    CoversModule,

    // Infraestructura
    MailModule,
    WebhooksModule,
    SchedulerModule,
  ],
})
export class AppModule {}
