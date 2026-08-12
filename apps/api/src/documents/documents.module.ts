import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateActHandler } from './commands/create-act.handler';
import { CreateInvoiceHandler } from './commands/create-invoice.handler';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PdfService } from './pdf.service';

@Module({
  imports: [CqrsModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    PdfService,
    CreateInvoiceHandler,
    CreateActHandler,
  ],
  exports: [DocumentsService, PdfService],
})
export class DocumentsModule {}
