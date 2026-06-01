import { Module, Global } from '@nestjs/common';
import { DocumentParserService } from './document-parser.service';

@Global()
@Module({
  providers: [DocumentParserService],
  exports:   [DocumentParserService],
})
export class CommonModule {}
