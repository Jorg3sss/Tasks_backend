import { Module }           from '@nestjs/common';
import { TypeOrmModule }    from '@nestjs/typeorm';
import { Subject }          from './entities/subject.entity';
import { UserSubject }      from './entities/user-subject.entity';
import { SubjectsService }  from './subjects.service';
import { SubjectsController } from './subjects.controller';
import { AuthModule }       from '../auth/auth.module';

@Module({
  imports:     [TypeOrmModule.forFeature([Subject, UserSubject]), AuthModule],
  providers:   [SubjectsService],
  controllers: [SubjectsController],
  exports:     [SubjectsService],
})
export class SubjectsModule {}
