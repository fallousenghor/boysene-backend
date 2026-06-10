import { IsString, IsOptional, IsNumber, IsArray, IsEnum, ValidateNested, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PurchaseStatus } from '@prisma/client';

export class PurchaseItemDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiProperty() @IsNumber() @Min(0) unitPrice: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() discount?: number;
}

export class CreatePurchaseDto {
  @ApiProperty() @IsString() supplierId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() expectedDate?: string;
  @ApiProperty({ type: [PurchaseItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseItemDto) items: PurchaseItemDto[];
  @ApiPropertyOptional() @IsOptional() @IsNumber() taxRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() discount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdatePurchaseDto extends PartialType(CreatePurchaseDto) {}

export class ReceivePurchaseDto {
  @ApiProperty({ description: 'Items received with quantities' })
  @IsArray()
  items: { purchaseItemId: string; received: number }[];
}

export class QueryPurchaseDto {
  @IsOptional() supplierId?: string;
  @IsOptional() status?: PurchaseStatus;
  @IsOptional() startDate?: string;
  @IsOptional() endDate?: string;
  @IsOptional() page?: number = 1;
  @IsOptional() limit?: number = 10;
}
