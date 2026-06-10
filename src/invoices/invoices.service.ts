import { Injectable, NotFoundException } from '@nestjs/common';
import { IsOptional, IsEnum, IsString, IsISO8601, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from './pdf.service';
import { InvoiceType, InvoiceStatus } from '@prisma/client';

export class QueryInvoiceDto {
  @IsOptional()
  @IsEnum(InvoiceType)
  type?: InvoiceType;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {}

  async findAll(query: QueryInvoiceDto) {
    const { type, status, customerId, supplierId, startDate, endDate, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (supplierId) where.supplierId = supplierId;
    if (startDate || endDate) {
      where.issueDate = {};
      if (startDate) where.issueDate.gte = new Date(startDate);
      if (endDate) where.issueDate.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where, skip, take: Number(limit),
        include: {
          customer: { select: { name: true, phone: true } },
          supplier: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        supplier: true,
        sale: { include: { items: { include: { product: true } } } },
        purchase: { include: { items: { include: { product: true } } } },
      },
    });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    return invoice;
  }

  async generatePdf(id: string): Promise<Buffer> {
    const invoice = await this.findOne(id);
    if (invoice.saleId) return this.pdfService.generateSaleInvoice(invoice.saleId);
    if (invoice.purchaseId) return this.pdfService.generatePurchaseOrder(invoice.purchaseId);
    throw new NotFoundException('Document source introuvable');
  }

  async generatePdfBySaleId(saleId: string): Promise<Buffer> {
    return this.pdfService.generateSaleInvoice(saleId);
  }

  async generatePdfByPurchaseId(purchaseId: string): Promise<Buffer> {
    return this.pdfService.generatePurchaseOrder(purchaseId);
  }

  async markAsSent(id: string) {
    await this.findOne(id);
    return this.prisma.invoice.update({ where: { id }, data: { status: 'SENT' } });
  }

  async updateStatus(id: string, status: InvoiceStatus) {
    await this.findOne(id);
    return this.prisma.invoice.update({ where: { id }, data: { status } });
  }
}
