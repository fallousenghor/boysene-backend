import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleDto, UpdateSaleDto, QuerySaleDto, ConfirmSaleDto, RecordPaymentDto, QuickSaleDto } from './dto/sale.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // ─────────────────────────────────────────────
  // 1. CREATION - Créer un brouillon
  // ─────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un brouillon de vente' })
  @ApiResponse({ status: 201, description: 'Brouillon créé avec succès' })
  create(@Body() dto: CreateSaleDto, @CurrentUser('id') userId: string) {
    return this.salesService.create(dto, userId);
  }

  // ─────────────────────────────────────────────
  // 2. LECTURE - Lister les ventes
  // ─────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Lister les ventes avec filtres' })
  @ApiResponse({ status: 200, description: 'Liste des ventes' })
  findAll(@Query() query: QuerySaleDto) {
    return this.salesService.findAll(query);
  }

  // ─────────────────────────────────────────────
  // 3. LECTURE - Récupérer une vente
  // ─────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Récupérer les détails d\'une vente' })
  @ApiResponse({ status: 200, description: 'Détails de la vente' })
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  // ─────────────────────────────────────────────
  // 4. MODIFICATION - Updater un brouillon
  // ─────────────────────────────────────────────
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Modifier une vente en brouillon' })
  @ApiResponse({ status: 200, description: 'Vente modifiée avec succès' })
  update(@Param('id') id: string, @Body() dto: UpdateSaleDto) {
    return this.salesService.update(id, dto);
  }

  // ─────────────────────────────────────────────
  // 5. CONFIRMATION - Finaliser la vente
  // ─────────────────────────────────────────────
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmer et finaliser une vente (déduction stock, création facture)' })
  @ApiResponse({ status: 200, description: 'Vente confirmée avec succès' })
  confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmSaleDto,
    @CurrentUser('id') userId: string
  ) {
    return this.salesService.confirm(id, dto, userId);
  }

  // ─────────────────────────────────────────────
  // 6. PAIEMENT - Enregistrer un paiement
  // ─────────────────────────────────────────────
  @Post(':id/payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enregistrer un paiement pour une vente' })
  @ApiResponse({ status: 200, description: 'Paiement enregistré avec succès' })
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser('id') userId: string
  ) {
    return this.salesService.recordPayment(id, dto, userId);
  }

  // ─────────────────────────────────────────────
  // 7. ANNULATION - Annuler une vente
  // ─────────────────────────────────────────────
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Annuler une vente (remboursement stock, annulation facture)' })
  @ApiResponse({ status: 200, description: 'Vente annulée avec succès' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.salesService.cancel(id, userId);
  }

  // ─────────────────────────────────────────────
  // QUICK SALE - Créer, confirmer et payer en un appel
  // ─────────────────────────────────────────────
  @Post('quick')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Vente express: création, confirmation et paiement en un seul appel' })
  @ApiResponse({ status: 201, description: 'Vente express créée et payée' })
  quickSale(@Body() dto: QuickSaleDto, @CurrentUser('id') userId: string) {
    return this.salesService.quickSale(dto, userId);
  }
}
