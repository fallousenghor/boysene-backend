import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

export class ReportQueryDto {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
  categoryId?: string;
  customerId?: string;
  supplierId?: string;
  format?: 'json' | 'excel';

  // Pagination (max 10 on frontend; backend must enforce)
  page?: number;
  limit?: number;
}


@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private getWhere(query: ReportQueryDto) {
    const where: any = {};
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }
    return where;
  }

  private getPagination(query: ReportQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.max(1, Math.min(10, Number(query.limit ?? 10)));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }


  async salesReport(query: ReportQueryDto) {
    const where = { ...this.getWhere(query), status: { not: 'CANCELLED' } } as any;
    if (query.customerId) where.customerId = query.customerId;

    const { page, limit, skip } = this.getPagination(query);

    const [total, sales] = await Promise.all([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        include: {
          customer: { select: { name: true, phone: true } },
          items: { include: { product: { include: { category: true } } } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const summary = {
      totalSales: total,
      totalRevenue: sales.reduce((s, sale) => s + sale.total, 0),
      totalPaid: sales.reduce((s, sale) => s + sale.amountPaid, 0),
      totalDue: sales.reduce((s, sale) => s + sale.amountDue, 0),
      avgSaleValue: sales.length ? sales.reduce((s, sale) => s + sale.total, 0) / sales.length : 0,
    };

    return { summary, data: sales, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }


  async purchasesReport(query: ReportQueryDto) {
    const where = { ...this.getWhere(query) } as any;
    if (query.supplierId) where.supplierId = query.supplierId;

    const { page, limit, skip } = this.getPagination(query);

    const [total, purchases] = await Promise.all([
      this.prisma.purchase.count({ where }),
      this.prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { name: true } },
          items: { include: { product: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const summary = {
      totalPurchases: total,
      totalAmount: purchases.reduce((s, p) => s + p.total, 0),
      totalPaid: purchases.reduce((s, p) => s + p.amountPaid, 0),
      totalDue: purchases.reduce((s, p) => s + p.amountDue, 0),
    };

    return { summary, data: purchases, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }


  async stockReport(query: ReportQueryDto) {
    const whereProducts = query.categoryId ? { categoryId: query.categoryId } : {};

    const { page, limit, skip } = this.getPagination(query);

    const [totalProducts, products] = await Promise.all([
      this.prisma.product.count({ where: whereProducts as any }),
      this.prisma.product.findMany({
        where: whereProducts as any,
        include: { category: true, brand: true },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const movements = await this.prisma.stockMovement.findMany({
      where: this.getWhere(query),
      include: {
        product: { select: { name: true, reference: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const inventoryValue = products.reduce((s, p) => s + p.currentStock * p.buyPrice, 0);
    const lowStock = products.filter((p) => p.currentStock <= p.minStock);

    return {
      summary: {
        totalProducts,
        inventoryValue,
        lowStockCount: lowStock.length,
        outOfStockCount: products.filter((p) => p.currentStock === 0).length,
      },
      products,
      movements,
      lowStock,
      meta: { total: totalProducts, page, limit, pages: Math.ceil(totalProducts / limit) },
    };
  }



  async customersReport(query: ReportQueryDto) {
    const customers = await this.prisma.customer.findMany({
      include: {
        _count: { select: { sales: true } },
      },
      orderBy: { balance: 'desc' },
    });

    const totalBalance = customers.reduce((s, c) => s + c.balance, 0);
    const debtors = customers.filter(c => c.balance > 0);

    return {
      summary: {
        totalCustomers: customers.length,
        activeCustomers: customers.filter(c => c.isActive).length,
        totalReceivable: totalBalance,
        debtorsCount: debtors.length,
      },
      data: customers,
    };
  }

  async suppliersReport(query: ReportQueryDto) {
    const suppliers = await this.prisma.supplier.findMany({
      include: { _count: { select: { purchases: true } } },
      orderBy: { name: 'asc' },
    });

    return {
      summary: { totalSuppliers: suppliers.length, activeSuppliers: suppliers.filter(s => s.isActive).length },
      data: suppliers,
    };
  }

  async paymentsReport(query: ReportQueryDto) {
    const where = this.getWhere(query);
    const payments = await this.prisma.payment.findMany({
      where,
      include: { customer: { select: { name: true } }, supplier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const income = payments.filter(p => p.type === 'INCOME').reduce((s, p) => s + p.amount, 0);
    const expense = payments.filter(p => p.type === 'EXPENSE').reduce((s, p) => s + p.amount, 0);
    const byMethod = payments.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + p.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      summary: { totalIncome: income, totalExpense: expense, balance: income - expense, byMethod },
      data: payments,
    };
  }

  async profitLossReport(query: ReportQueryDto) {
    const where = this.getWhere(query);

    const [salesAgg, purchasesAgg] = await Promise.all([
      this.prisma.sale.aggregate({ where: { ...where, status: { not: 'CANCELLED' } }, _sum: { total: true, amountPaid: true } }),
      this.prisma.purchase.aggregate({ where: { ...where, status: { not: 'CANCELLED' } }, _sum: { total: true } }),
    ]);

    const revenue = salesAgg._sum.total || 0;
    const cogs = purchasesAgg._sum.total || 0;
    const grossProfit = revenue - cogs;
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    return {
      revenue,
      cogs,
      grossProfit,
      margin: Math.round(margin * 100) / 100,
      period: { start: query.startDate, end: query.endDate },
    };
  }

  async exportToExcel(reportType: string, query: ReportQueryDto): Promise<Buffer> {
    let data: any;
    let sheetName = 'Rapport';
    let rows: any[] = [];

    switch (reportType) {
      case 'sales':
        data = await this.salesReport(query);
        sheetName = 'Ventes';
        rows = data.data.map(s => ({
          'Référence': s.reference,
          'Date': new Date(s.createdAt).toLocaleDateString('fr-FR'),
          'Client': s.customer?.name || 'Comptant',
          'Vendeur': `${s.user.firstName} ${s.user.lastName}`,
          'Sous-total': s.subtotal,
          'Remise': s.discount,
          'TVA': s.taxAmount,
          'Total': s.total,
          'Payé': s.amountPaid,
          'Reste': s.amountDue,
          'Statut': s.status,
        }));
        break;
      case 'purchases':
        data = await this.purchasesReport(query);
        sheetName = 'Achats';
        rows = data.data.map(p => ({
          'Référence': p.reference,
          'Date': new Date(p.createdAt).toLocaleDateString('fr-FR'),
          'Fournisseur': p.supplier.name,
          'Total': p.total,
          'Payé': p.amountPaid,
          'Reste': p.amountDue,
          'Statut': p.status,
        }));
        break;
      case 'stock':
        data = await this.stockReport(query);
        sheetName = 'Stock';
        rows = data.products.map(p => ({
          'Référence': p.reference,
          'Produit': p.name,
          'Catégorie': p.category.name,
          'Stock actuel': p.currentStock,
          'Stock min': p.minStock,
          'Prix achat': p.buyPrice,
          'Prix vente': p.sellPrice,
          'Valeur stock': p.currentStock * p.buyPrice,
          'Statut': p.currentStock <= p.minStock ? 'ALERTE' : 'OK',
        }));
        break;
      case 'customers':
        data = await this.customersReport(query);
        sheetName = 'Clients';
        rows = data.data.map(c => ({
          'Code': c.code,
          'Nom': c.name,
          'Téléphone': c.phone,
          'WhatsApp': c.whatsapp,
          'Email': c.email,
          'Ville': c.city,
          'Solde dû': c.balance,
          'Actif': c.isActive ? 'Oui' : 'Non',
        }));
        break;
      default:
        rows = [];
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
}
