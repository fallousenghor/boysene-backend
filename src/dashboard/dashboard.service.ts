import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private serializeBigInt<T>(value: T): any {
    const convert = (v: any): any => {
      if (typeof v === 'bigint') {
        // convert to number when safe, otherwise to string
        try {
          const n = Number(v);
          if (Number.isSafeInteger(n)) return n;
          return v.toString();
        } catch (e) {
          return v.toString();
        }
      }
      if (Array.isArray(v)) return v.map(convert);
      if (v && typeof v === 'object') {
        // handle Date
        if (v instanceof Date) return v.toISOString();
        const out: any = {};
        for (const [k, val] of Object.entries(v)) out[k] = convert(val);
        return out;
      }
      return v;
    };

    return convert(value);
  }

  private getDateRange(period: string) {
    const now = new Date();
    const start = new Date();
    switch (period) {
      case 'day':   start.setHours(0, 0, 0, 0); break;
      case 'week':  start.setDate(now.getDate() - 7); break;
      case 'month': start.setMonth(now.getMonth(), 1); start.setHours(0, 0, 0, 0); break;
      case 'year':  start.setMonth(0, 1); start.setHours(0, 0, 0, 0); break;
      default:      start.setMonth(now.getMonth(), 1); start.setHours(0, 0, 0, 0);
    }
    return { start, end: now };
  }

  async getStats(period = 'month') {
    const { start, end } = this.getDateRange(period);
    const dateFilter = { gte: start, lte: end };

    const [
      salesAgg,
      purchasesAgg,
      salesCount,
      purchasesCount,
      customersCount,
      suppliersCount,
      productsCount,
      lowStockCount,
      pendingAgg,
      pendingCount,
      totalReceivable,
    ] = await Promise.all([
      // Sales this period (use raw SQL and cast status to text to avoid enum cast errors)
      this.prisma.$queryRaw<any>`
        SELECT COALESCE(SUM("amountPaid"),0) as sum_amount_paid, COUNT(*) as count
        FROM sales
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
          AND status::text != 'CANCELLED'
      `,
      // Purchases this period (coût seulement quand reçu/partiellement reçu)
      this.prisma.purchase.aggregate({
        where: {
          createdAt: dateFilter,
          status: { in: ['RECEIVED', 'PARTIAL'] },
        },
        _sum: { total: true },
        _count: true,
      }),
      // Sales count (raw SQL)
      this.prisma.$queryRaw<any>`
        SELECT COUNT(*) as count
        FROM sales
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
          AND status::text != 'CANCELLED'
      `,
      // Purchases count
      this.prisma.purchase.count({ where: { createdAt: dateFilter, status: { in: ['RECEIVED', 'PARTIAL'] } } }),
      this.prisma.customer.count({ where: { isActive: true } }),
      this.prisma.supplier.count({ where: { isActive: true } }),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      // Low stock
      this.prisma.product.count({ where: { status: 'ACTIVE', currentStock: { lte: 10 } } }),
      // Confirmed / partially paid sales (raw SQL, cast status to text)
      this.prisma.$queryRaw<any>`
        SELECT COALESCE(SUM("amountDue"),0) as sum_amount_due, COUNT(*) as count
        FROM sales
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
          AND status::text IN ('CONFIRMED','PARTIAL_PAID')
      `,
      // Confirmed / partially paid count (raw SQL)
      this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM sales
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
          AND status::text IN ('CONFIRMED','PARTIAL_PAID')
      `,
      // Total receivable (customer balances)
      this.prisma.customer.aggregate({ _sum: { balance: true } }),
    ]);

    // Normalize raw SQL / aggregate results
    const revenueRaw = (Array.isArray(salesAgg) ? salesAgg[0]?.sum_amount_paid : (salesAgg?._sum?.amountPaid));
    const revenue = revenueRaw ?? 0;
    const purchases = (purchasesAgg._sum && (purchasesAgg._sum.total ?? 0)) || 0;
    const profit = revenue - purchases;

    const safeNumber = (v: any) => {
      if (v === null || v === undefined) return 0;
      if (typeof v === 'bigint') return Number(v);
      if (typeof v === 'string') {
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      }
      return v;
    };

    return {
      revenue: safeNumber(revenue),
      purchases: safeNumber(purchases),
      profit: safeNumber(profit),
      salesCount: safeNumber(Array.isArray(salesCount) ? (salesCount[0]?.count ?? 0) : salesCount),
      purchasesCount: safeNumber(purchasesCount),
      customersCount: safeNumber(customersCount),
      suppliersCount: safeNumber(suppliersCount),
      productsCount: safeNumber(productsCount),
      lowStockCount: safeNumber(lowStockCount),
      pendingAmount: safeNumber(Array.isArray(pendingAgg) ? (pendingAgg[0]?.sum_amount_due ?? 0) : (pendingAgg._sum ? (pendingAgg._sum.amountDue ?? 0) : 0)),
      pendingSalesCount: safeNumber(Array.isArray(pendingCount) ? (pendingCount[0]?.count ?? 0) : pendingCount),
      totalReceivable: safeNumber((totalReceivable._sum && (totalReceivable._sum.balance ?? 0)) || 0),
    };
  }

  async getSalesChart(days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    // Use raw SQL and cast status to text to avoid enum casting errors
    const rows: Array<{ date: string; revenue: string; count: string }> = await this.prisma.$queryRaw`
      SELECT to_char("createdAt", 'YYYY-MM-DD') as date,
             COALESCE(SUM("total"),0)::text as revenue,
             COUNT(*)::text as count
      FROM sales
      WHERE "createdAt" >= ${start} AND "createdAt" <= NOW()
        AND status::text != 'CANCELLED'
      GROUP BY date
      ORDER BY date ASC
    `;

    return rows.map(r => ({ date: r.date, revenue: Number(r.revenue), count: Number(r.count) }));
  }

  async getPurchasesChart(days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);

    const purchases = await this.prisma.purchase.findMany({
      where: { createdAt: { gte: start }, status: { not: 'CANCELLED' } },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: 'asc' },
    });

    const grouped: Record<string, { date: string; amount: number; count: number }> = {};
    for (const p of purchases) {
      const date = p.createdAt.toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = { date, amount: 0, count: 0 };
      grouped[date].amount += p.total;
      grouped[date].count += 1;
    }

    return Object.values(grouped);
  }

  async getSalesByCategory() {
    return this.prisma.$queryRaw<any>`
      SELECT c.name as category, 
             SUM(si.total) as total,
             SUM(si.quantity) as quantity,
             COUNT(DISTINCT s.id) as sales_count
      FROM sale_items si
      JOIN products p ON si."productId" = p.id
      JOIN categories c ON p."categoryId" = c.id
      JOIN sales s ON si."saleId" = s.id
      WHERE s.status::text != 'CANCELLED'
      AND s."createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY c.name
      ORDER BY total DESC
      LIMIT 10
    `;
  }

  async getTopProducts(limit = 10) {
    return this.prisma.$queryRaw<any>`
      SELECT p.id, p.name, p.reference,
             SUM(si.quantity) as total_sold,
             SUM(si.total) as total_revenue
      FROM sale_items si
      JOIN products p ON si."productId" = p.id
      JOIN sales s ON si."saleId" = s.id
      WHERE s.status::text != 'CANCELLED'
      AND s."createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY p.id, p.name, p.reference
      ORDER BY total_sold DESC
      LIMIT ${limit}
    `;
  }

  async getTopCustomers(limit = 10) {
    return this.prisma.$queryRaw<any>`
      SELECT c.id, c.name, c.phone,
             COUNT(s.id) as sales_count,
             SUM(s.total) as total_spent,
             SUM(s."amountPaid") as total_paid
      FROM customers c
      JOIN sales s ON s."customerId" = c.id
      WHERE s.status::text != 'CANCELLED'
      AND s."createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY c.id, c.name, c.phone
      ORDER BY total_spent DESC
      LIMIT ${limit}
    `;
  }

  async getTopSuppliers(limit = 10) {
    return this.prisma.$queryRaw<any>`
      SELECT sup.id, sup.name, sup.phone,
             COUNT(pu.id) as purchase_count,
             SUM(pu.total) as total_purchased
      FROM suppliers sup
      JOIN purchases pu ON pu."supplierId" = sup.id
      WHERE pu.status::text != 'CANCELLED'
      AND pu."createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY sup.id, sup.name, sup.phone
      ORDER BY total_purchased DESC
      LIMIT ${limit}
    `;
  }

  async getLowStockAlerts() {
    return this.prisma.product.findMany({
      where: { status: 'ACTIVE', currentStock: { lte: 10 } },
      include: { category: true },
      orderBy: { currentStock: 'asc' },
      take: 20,
    });
  }

  async getRecentActivity() {
    const [recentSales, recentPurchases, recentPayments] = await Promise.all([
      // Use raw SQL for sales because DB may contain legacy enum values
      // not present anymore in Prisma's SaleStatus (e.g. 'PARTIAL').
      this.prisma.$queryRaw<any>`
        SELECT
          s.id,
          s.reference,
          s."createdAt",
          s."total",
          s."amountPaid",
          s.status::text as status,
          c.name as "customerName"
        FROM sales s
        LEFT JOIN customers c ON c.id = s."customerId"
        ORDER BY s."createdAt" DESC
        LIMIT 5
      `,
      this.prisma.purchase.findMany({
        take: 5,
        select: {
          id: true,
          reference: true,
          createdAt: true,
          total: true,
          status: true,
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.findMany({
        take: 5,
        select: {
          id: true,
          reference: true,
          createdAt: true,
          amount: true,
          type: true,
          method: true,
          customer: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Keep response shape similar to the previous Prisma select
    // (customer: { name }) while allowing legacy statuses.
    const normalizedRecentSales = (Array.isArray(recentSales) ? recentSales : []).map((s: any) => ({
      id: s.id,
      reference: s.reference,
      createdAt: s.createdAt ?? s.createdAt,
      total: s.total,
      amountPaid: s.amountPaid,
      status: s.status,
      customer: s.customerName ? { name: s.customerName } : null,
    }));

    return {
      recentSales: normalizedRecentSales,
      recentPurchases,
      recentPayments,
    };
  }

  async getFullDashboard(period = 'month') {
    const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'year' ? 365 : 30;

    const [stats, salesChart, salesByCategory, topProducts, topCustomers, lowStock, activity] = await Promise.all([
      this.getStats(period),
      this.getSalesChart(days),
      this.getSalesByCategory(),
      this.getTopProducts(),
      this.getTopCustomers(),
      this.getLowStockAlerts(),
      this.getRecentActivity(),
    ]);

    const result = { stats, salesChart, salesByCategory, topProducts, topCustomers, lowStock, activity };
    return this.serializeBigInt(result);
  }
}
