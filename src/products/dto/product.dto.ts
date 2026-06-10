import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsString() categoryId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brandId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() barcode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiProperty() @IsNumber() @Min(0) buyPrice: number;
  @ApiProperty() @IsNumber() @Min(0) sellPrice: number;
  @ApiPropertyOptional() @IsOptional() @IsString() image?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() minStock?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() currentStock?: number;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional() @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
}

export class QueryProductDto {
  @ApiPropertyOptional() @IsOptional() search?: string;
  @ApiPropertyOptional() @IsOptional() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() brandId?: string;
  @ApiPropertyOptional() @IsOptional() status?: ProductStatus;
  @ApiPropertyOptional() @IsOptional() lowStock?: boolean;
  @ApiPropertyOptional() @IsOptional() page?: number = 1;
  @ApiPropertyOptional() @IsOptional() limit?: number = 10;
}
