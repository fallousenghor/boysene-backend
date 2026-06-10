import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
@ApiTags('dashboard') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
  @Get() getFullDashboard(@Query('period') period?: string) { return this.dashboardService.getFullDashboard(period); }
  @Get('stats') getStats(@Query('period') period?: string) { return this.dashboardService.getStats(period); }
  @Get('sales-chart') getSalesChart(@Query('days') days?: number) { return this.dashboardService.getSalesChart(days); }
  @Get('purchases-chart') getPurchasesChart(@Query('days') days?: number) { return this.dashboardService.getPurchasesChart(days); }
  @Get('sales-by-category') getSalesByCategory() { return this.dashboardService.getSalesByCategory(); }
  @Get('top-products') getTopProducts(@Query('limit') limit?: number) { return this.dashboardService.getTopProducts(limit); }
  @Get('top-customers') getTopCustomers(@Query('limit') limit?: number) { return this.dashboardService.getTopCustomers(limit); }
  @Get('top-suppliers') getTopSuppliers(@Query('limit') limit?: number) { return this.dashboardService.getTopSuppliers(limit); }
  @Get('low-stock') getLowStock() { return this.dashboardService.getLowStockAlerts(); }
  @Get('activity') getActivity() { return this.dashboardService.getRecentActivity(); }
}
