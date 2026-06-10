import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, QueryCustomerDto } from './dto/customer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
@ApiTags('customers') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}
  @Post() create(@Body() dto: CreateCustomerDto) { return this.customersService.create(dto); }
  @Get() findAll(@Query() query: QueryCustomerDto) { return this.customersService.findAll(query); }
  @Get(':id') findOne(@Param('id') id: string) { return this.customersService.findOne(id); }
  @Get(':id/history') getHistory(@Param('id') id: string) { return this.customersService.getHistory(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) { return this.customersService.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.customersService.remove(id); }
}
