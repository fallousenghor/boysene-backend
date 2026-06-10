import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto, QuerySupplierDto } from './dto/supplier.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
@ApiTags('suppliers') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}
  @Post() create(@Body() dto: CreateSupplierDto) { return this.suppliersService.create(dto); }
  @Get() findAll(@Query() query: QuerySupplierDto) { return this.suppliersService.findAll(query); }
  @Get(':id') findOne(@Param('id') id: string) { return this.suppliersService.findOne(id); }
  @Get(':id/history') getHistory(@Param('id') id: string) { return this.suppliersService.getHistory(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) { return this.suppliersService.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.suppliersService.remove(id); }
}
