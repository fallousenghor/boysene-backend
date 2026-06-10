import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, QueryPaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
@ApiTags('payments') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}
  @Post() create(@Body() dto: CreatePaymentDto) { return this.paymentsService.create(dto); }
  @Get() findAll(@Query() query: QueryPaymentDto) { return this.paymentsService.findAll(query); }
  @Get('summary') getSummary(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) { return this.paymentsService.getSummary(startDate, endDate); }
  @Get(':id') findOne(@Param('id') id: string) { return this.paymentsService.findOne(id); }
}
