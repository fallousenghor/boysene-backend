import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentType } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ enum: PaymentType }) @IsEnum(PaymentType) type: PaymentType;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method: PaymentMethod;
  @ApiProperty() @IsNumber() @Min(0) amount: number;
  @ApiPropertyOptional() @IsOptional() @IsString() saleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() purchaseId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() transactionId?: string;
}

export class QueryPaymentDto {
  @IsOptional() type?: PaymentType;
  @IsOptional() method?: PaymentMethod;
  @IsOptional() customerId?: string;
  @IsOptional() supplierId?: string;
  @IsOptional() saleId?: string;
  @IsOptional() purchaseId?: string;
  @IsOptional() startDate?: string;
  @IsOptional() endDate?: string;
  @IsOptional() page?: number = 1;
  @IsOptional() limit?: number = 10;
}
