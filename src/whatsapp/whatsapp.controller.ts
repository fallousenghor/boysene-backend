import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { SendMessageDto, QueryWhatsappDto } from './dto/whatsapp.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
@ApiTags('whatsapp') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}
  @Post('send') sendCustom(@Body() dto: SendMessageDto) { return this.whatsappService.sendCustomMessage(dto.to, dto.message, dto.recipientId, dto.recipientType); }
  @Post('sale/:saleId') sendSaleInvoice(@Param('saleId') saleId: string) { return this.whatsappService.sendSaleInvoice(saleId); }
  @Post('purchase/:purchaseId') sendPurchaseOrder(@Param('purchaseId') purchaseId: string) { return this.whatsappService.sendPurchaseOrder(purchaseId); }
  @Post('payment/:saleId') sendPaymentReceipt(@Param('saleId') saleId: string) { return this.whatsappService.sendPaymentReceipt(saleId); }
  @Post('reminder/:customerId') sendReminder(@Param('customerId') customerId: string) { return this.whatsappService.sendCreditReminder(customerId); }
  @Get('history') getHistory(@Query() query: QueryWhatsappDto) { return this.whatsappService.getHistory(query); }
}
