import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BrandsService } from './brands.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
@ApiTags('brands') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}
  @Post() create(@Body() dto: CreateBrandDto) { return this.brandsService.create(dto); }
  @Get() findAll() { return this.brandsService.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.brandsService.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateBrandDto) { return this.brandsService.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.brandsService.remove(id); }
}
