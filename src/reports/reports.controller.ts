import { Controller, Get, Query, Res, Param, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService, ReportQueryDto } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('reports') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales') salesReport(@Query() query: ReportQueryDto) { return this.reportsService.salesReport(query); }
  @Get('purchases') purchasesReport(@Query() query: ReportQueryDto) { return this.reportsService.purchasesReport(query); }
  @Get('stock') stockReport(@Query() query: ReportQueryDto) { return this.reportsService.stockReport(query); }
  @Get('customers') customersReport(@Query() query: ReportQueryDto) { return this.reportsService.customersReport(query); }
  @Get('suppliers') suppliersReport(@Query() query: ReportQueryDto) { return this.reportsService.suppliersReport(query); }
  @Get('payments') paymentsReport(@Query() query: ReportQueryDto) { return this.reportsService.paymentsReport(query); }
  @Get('profit-loss') profitLoss(@Query() query: ReportQueryDto) { return this.reportsService.profitLossReport(query); }

  @Get(':type/export/excel')
  async exportExcel(@Param('type') type: string, @Query() query: ReportQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.exportToExcel(type, query);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rapport-${type}-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.status(HttpStatus.OK).end(buffer);
  }
}
