import { IsString, IsOptional, IsNumber, IsArray, IsEnum, ValidateNested, Min, Max, ValidateIf, IsDate } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────
// LINE ITEM
// ─────────────────────────────────────────────

export class SaleItemDto {
  @ApiProperty({ description: 'ID du produit' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Quantité vendue', minimum: 1 })
  @IsNumber()
  @Min(1, { message: 'La quantité doit être >= 1' })
  quantity: number;

  @ApiProperty({ description: 'Prix unitaire de vente' })
  @IsNumber()
  @Min(0, { message: 'Le prix unitaire doit être >= 0' })
  unitPrice: number;

  @ApiPropertyOptional({ description: 'Remise sur la ligne (en %)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;
}

// ─────────────────────────────────────────────
// CREATION - Brouillon initial
// ─────────────────────────────────────────────

export class CreateSaleDto {
  @ApiPropertyOptional({ description: 'ID client optionnel (comptant si absent)' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ description: 'Articles à vendre', type: [SaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @ApiPropertyOptional({ description: 'Type de paiement: CASH=comptant, CREDIT=crédit', default: 'CREDIT' })
  @IsOptional()
  @IsEnum(['CASH', 'CREDIT'])
  paymentType?: 'CASH' | 'CREDIT';

  @ApiPropertyOptional({ description: 'Taux de TVA (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional({ description: 'Remise globale (montant en devise)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ description: 'Notes internes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─────────────────────────────────────────────
// MODIFICATION - Updater brouillon avant confirmation
// ─────────────────────────────────────────────

export class UpdateSaleDto {
  @ApiPropertyOptional({ description: 'ID client' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Articles à vendre', type: [SaleItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items?: SaleItemDto[];

  @ApiPropertyOptional({ description: 'Taux de TVA (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional({ description: 'Remise globale' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ description: 'Notes internes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─────────────────────────────────────────────
// CONFIRMATION - Finaliser et passer en CONFIRMED
// ─────────────────────────────────────────────

export class ConfirmSaleDto {
  @ApiPropertyOptional({ description: 'Montant payé immédiatement (pour comptant)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @ApiPropertyOptional({ description: 'Méthode de paiement si montant payé' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Notes de confirmation' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─────────────────────────────────────────────
// PAIEMENT - Ajouter/enregistrer paiement
// ─────────────────────────────────────────────

export class RecordPaymentDto {
  @ApiProperty({ description: 'Montant à payer' })
  @IsNumber()
  @Min(0, { message: 'Le montant doit être > 0' })
  amount: number;

  @ApiProperty({ description: 'Méthode de paiement' })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({ description: 'Notes sur le paiement' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─────────────────────────────────────────────
// QUICK SALE - Création + Confirmation + Paiement en un appel
// ─────────────────────────────────────────────

export class QuickSaleItemDto {
  @ApiProperty({ description: 'ID du produit ou référence/barcode', examples: ['uuid-or-barcode'] })
  @IsString()
  productRef: string;

  @ApiProperty({ description: 'Quantité vendue', minimum: 1 })
  @IsNumber()
  @Min(1, { message: 'La quantité doit être >= 1' })
  quantity: number;

  @ApiPropertyOptional({ description: 'Prix personnalisé (optionnel, utilise le prix de vente par défaut)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Remise sur la ligne (en %)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;
}

export class QuickSaleDto {
  @ApiPropertyOptional({ description: 'ID client (comptant si absent)' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ description: 'Articles à vendre', type: [QuickSaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuickSaleItemDto)
  items: QuickSaleItemDto[];

  @ApiProperty({ description: 'Mode de paiement' })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({ description: 'Taux de TVA (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional({ description: 'Remise globale (montant)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ description: 'Notes internes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─────────────────────────────────────────────
// REQUÊTE - Filtrage et pagination
// ─────────────────────────────────────────────

export class QuerySaleDto {
  @ApiPropertyOptional({ description: 'Filtrer par ID client' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filtrer par ID vendeur' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filtrer par statut' })
  @IsOptional()
  @IsEnum(['DRAFT', 'CONFIRMED', 'PARTIAL_PAID', 'FULLY_PAID', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Type de paiement: CASH ou CREDIT' })
  @IsOptional()
  @IsEnum(['CASH', 'CREDIT'])
  paymentType?: string;

  @ApiPropertyOptional({ description: 'Date de début (ISO 8601)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Date de fin (ISO 8601)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Recherche par référence ou client' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page (défaut: 1)' })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Articles par page (défaut: 10)' })
  @IsOptional()
  @IsNumber()
  limit?: number;
}
