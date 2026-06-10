import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto, QueryPaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  private generateRef() { return `PAY-${Date.now().toString().slice(-8)}`; }

  async create(dto: CreatePaymentDto) {
    if (dto.amount <= 0) throw new BadRequestException('Le montant doit être supérieur à 0');
    if (dto.saleId && dto.purchaseId) throw new BadRequestException('Un paiement ne peut pas concerner une vente et un achat à la fois');

    return this.prisma.$transaction(async (tx) => {
      let paymentData = { ...dto };

      if (dto.saleId) {
        const sale = await tx.sale.findUnique({ where: { id: dto.saleId } });
        if (!sale) throw new NotFoundException('Vente non trouvée');
        if (sale.status === 'CANCELLED') throw new BadRequestException('Vente annulée');
        if (dto.type !== 'INCOME') throw new BadRequestException('Une vente attend un paiement de type INCOME');
        if (dto.amount > sale.amountDue) throw new BadRequestException('Montant supérieur au solde dû');

        const amountPaid = sale.amountPaid + dto.amount;
        const amountDue = Math.max(sale.total - amountPaid, 0);
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            amountPaid,
            amountDue,
            status: amountDue <= 0 ? 'FULLY_PAID' : 'PARTIAL_PAID',
          },
        });

        if (sale.customerId) {
          await tx.customer.update({
            where: { id: sale.customerId },
            data: { balance: { decrement: dto.amount } },
          });
        }

        paymentData = { ...paymentData, customerId: dto.customerId || sale.customerId || undefined };
      }

      if (dto.purchaseId) {
        const purchase = await tx.purchase.findUnique({ where: { id: dto.purchaseId } });
        if (!purchase) throw new NotFoundException('Achat non trouvé');
        if (purchase.status === 'CANCELLED') throw new BadRequestException('Achat annulé');
        if (dto.type !== 'EXPENSE') throw new BadRequestException('Un achat attend un paiement de type EXPENSE');
        if (dto.amount > purchase.amountDue) throw new BadRequestException('Montant supérieur au solde dû');

        const amountPaid = purchase.amountPaid + dto.amount;
        const amountDue = Math.max(purchase.total - amountPaid, 0);
        await tx.purchase.update({
          where: { id: purchase.id },
          data: { amountPaid, amountDue },
        });

        await tx.supplier.update({
          where: { id: purchase.supplierId },
          data: { balance: { decrement: dto.amount } },
        });

        paymentData = { ...paymentData, supplierId: dto.supplierId || purchase.supplierId };
      }

      if (!dto.saleId && !dto.purchaseId) {
        if (dto.type === 'INCOME' && dto.customerId) {
          await tx.customer.update({
            where: { id: dto.customerId },
            data: { balance: { decrement: dto.amount } },
          });
        }

        if (dto.type === 'EXPENSE' && dto.supplierId) {
          await tx.supplier.update({
            where: { id: dto.supplierId },
            data: { balance: { decrement: dto.amount } },
          });
        }
      }

      return tx.payment.create({
        data: { ...paymentData, reference: this.generateRef() },
        include: { customer: true, supplier: true, sale: true, purchase: true },
      });
    });
  }

  async findAll(query: QueryPaymentDto) {
    const { type, method, customerId, supplierId, saleId, purchaseId, startDate, endDate, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (type) where.type = type;
    if (method) where.method = method;
    if (customerId) where.customerId = customerId;
    if (supplierId) where.supplierId = supplierId;
    if (saleId) where.saleId = saleId;
    if (purchaseId) where.purchaseId = purchaseId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where, skip, take: Number(limit),
        include: { customer: { select: { name: true } }, supplier: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    const totalAmount = await this.prisma.payment.aggregate({ where, _sum: { amount: true } });

    return {
      data,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
      summary: { totalAmount: totalAmount._sum.amount || 0 },
    };
  }

  async findOne(id: string) {
    const p = await this.prisma.payment.findUnique({
      where: { id },
      include: { customer: true, supplier: true, sale: true, purchase: true },
    });
    if (!p) throw new NotFoundException('Paiement non trouvé');
    return p;
  }

  async getSummary(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [income, expense, byMethod] = await Promise.all([
      this.prisma.payment.aggregate({ where: { ...where, type: 'INCOME' }, _sum: { amount: true }, _count: true }),
      this.prisma.payment.aggregate({ where: { ...where, type: 'EXPENSE' }, _sum: { amount: true }, _count: true }),
      this.prisma.payment.groupBy({ by: ['method'], where, _sum: { amount: true }, _count: true }),
    ]);

    return {
      totalIncome: income._sum.amount || 0,
      totalExpense: expense._sum.amount || 0,
      balance: (income._sum.amount || 0) - (expense._sum.amount || 0),
      incomeCount: income._count,
      expenseCount: expense._count,
      byMethod,
    };
  }
}
