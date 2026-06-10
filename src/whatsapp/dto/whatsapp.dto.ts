import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class SendMessageDto {
  @ApiProperty() @IsString() to: string;
  @ApiProperty() @IsString() message: string;
  @ApiPropertyOptional() @IsOptional() @IsString() recipientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(['customer','supplier']) recipientType?: 'customer' | 'supplier';
}
export class SendSaleInvoiceDto {
  @ApiProperty() @IsString() saleId: string;
}
export class SendPurchaseOrderDto {
  @ApiProperty() @IsString() purchaseId: string;
}
export class QueryWhatsappDto {
  @IsOptional() customerId?: string;
  @IsOptional() supplierId?: string;
  @IsOptional() status?: string;
  @IsOptional() page?: number = 1;
  @IsOptional() limit?: number = 20;
}
