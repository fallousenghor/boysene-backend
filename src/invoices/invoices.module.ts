import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PdfService } from './pdf.service';
@Module({ controllers: [InvoicesController], providers: [InvoicesService, PdfService], exports: [InvoicesService, PdfService] })
export class InvoicesModule {}
