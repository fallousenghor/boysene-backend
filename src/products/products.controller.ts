import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, QueryProductDto } from './dto/product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
@ApiTags('products') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}
  @Post() create(@Body() dto: CreateProductDto) { return this.productsService.create(dto); }
  @Get() findAll(@Query() query: QueryProductDto) { return this.productsService.findAll(query); }
  @Get('low-stock') getLowStock() { return this.productsService.getLowStockProducts(); }
  @Get('barcode/:barcode') findByBarcode(@Param('barcode') barcode: string) { return this.productsService.findByBarcode(barcode); }
  @Get(':id') findOne(@Param('id') id: string) { return this.productsService.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateProductDto) { return this.productsService.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.productsService.remove(id); }
}
