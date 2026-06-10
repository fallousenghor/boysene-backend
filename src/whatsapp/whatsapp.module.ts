import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { PdfService } from '../invoices/pdf.service';
@Module({ controllers: [WhatsappController], providers: [WhatsappService, PdfService], exports: [WhatsappService] })
export class WhatsappModule {}
