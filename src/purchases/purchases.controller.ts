import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto, UpdatePurchaseDto, ReceivePurchaseDto, QueryPurchaseDto } from './dto/purchase.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
@ApiTags('purchases') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}
  @Post() create(@Body() dto: CreatePurchaseDto, @CurrentUser('id') userId: string) { return this.purchasesService.create(dto, userId); }
  @Get() findAll(@Query() query: QueryPurchaseDto) { return this.purchasesService.findAll(query); }
  @Get(':id') findOne(@Param('id') id: string) { return this.purchasesService.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdatePurchaseDto) { return this.purchasesService.update(id, dto); }
  @Post(':id/confirm') confirm(@Param('id') id: string) { return this.purchasesService.confirm(id); }
  @Post(':id/receive') receive(@Param('id') id: string, @Body() dto: ReceivePurchaseDto, @CurrentUser('id') userId: string) { return this.purchasesService.receive(id, dto, userId); }
  @Post(':id/cancel') cancel(@Param('id') id: string) { return this.purchasesService.cancel(id); }
}
