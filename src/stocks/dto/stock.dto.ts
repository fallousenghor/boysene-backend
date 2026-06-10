import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovementType } from '@prisma/client';

export class CreateMovementDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty({ enum: MovementType }) @IsEnum(MovementType) type: MovementType;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() unitCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
}

export class AdjustStockDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsNumber() newQuantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class QueryMovementDto {
  @ApiPropertyOptional() @IsOptional() productId?: string;
  @ApiPropertyOptional() @IsOptional() type?: MovementType;
  @ApiPropertyOptional() @IsOptional() startDate?: string;
  @ApiPropertyOptional() @IsOptional() endDate?: string;
  @ApiPropertyOptional() @IsOptional() page?: number = 1;
  @ApiPropertyOptional() @IsOptional() limit?: number = 20;
}

export class QueryInventoryDto {
  @ApiPropertyOptional() @IsOptional() search?: string;
  @ApiPropertyOptional() @IsOptional() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() brandId?: string;
  @ApiPropertyOptional() @IsOptional() lowStock?: boolean;
  @ApiPropertyOptional() @IsOptional() page?: number = 1;
  @ApiPropertyOptional() @IsOptional() limit?: number = 20;
}
