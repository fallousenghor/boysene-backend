import { Controller, Get, Param, Query, Res, Post, Body, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { InvoicesService, QueryInvoiceDto } from './invoices.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('invoices') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get() findAll(@Query() query: QueryInvoiceDto) { return this.invoicesService.findAll(query); }

  // Specific routes BEFORE generic routes to avoid :id catching everything
  @Get('sale/:saleId/pdf')
  async generateSalePdf(@Param('saleId') saleId: string, @Res() res: Response) {
    const buffer = await this.invoicesService.generatePdfBySaleId(saleId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="facture-${saleId}.pdf"`, 'Content-Length': buffer.length });
    res.status(HttpStatus.OK).end(buffer);
  }

  @Get('purchase/:purchaseId/pdf')
  async generatePurchasePdf(@Param('purchaseId') purchaseId: string, @Res() res: Response) {
    const buffer = await this.invoicesService.generatePdfByPurchaseId(purchaseId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="bon-commande-${purchaseId}.pdf"`, 'Content-Length': buffer.length });
    res.status(HttpStatus.OK).end(buffer);
  }

  @Get(':id/pdf')
  async generatePdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.invoicesService.generatePdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="invoice-${id}.pdf"`, 'Content-Length': buffer.length });
    res.status(HttpStatus.OK).end(buffer);
  }

  // Generic routes AFTER specific routes
  @Get(':id') findOne(@Param('id') id: string) { return this.invoicesService.findOne(id); }

  @Post(':id/send') markAsSent(@Param('id') id: string) { return this.invoicesService.markAsSent(id); }
}
