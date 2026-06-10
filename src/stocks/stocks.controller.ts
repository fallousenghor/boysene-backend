import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StocksService } from './stocks.service';
import { CreateMovementDto, AdjustStockDto, QueryMovementDto, QueryInventoryDto } from './dto/stock.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
@ApiTags('stocks') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}
  @Post('movement') addMovement(@Body() dto: CreateMovementDto, @CurrentUser('id') userId: string) { return this.stocksService.addMovement(dto, userId); }
  @Post('adjust') adjustStock(@Body() dto: AdjustStockDto, @CurrentUser('id') userId: string) { return this.stocksService.adjustStock(dto, userId); }
  @Get('movements') getMovements(@Query() query: QueryMovementDto) { return this.stocksService.getMovements(query); }
  @Get('inventory') getInventory(@Query() query: QueryInventoryDto) { return this.stocksService.getInventory(query); }
  @Get('alerts') getAlerts() { return this.stocksService.getAlerts(); }
}
