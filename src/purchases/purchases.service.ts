import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto, UpdatePurchaseDto, ReceivePurchaseDto, QueryPurchaseDto } from './dto/purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService) {}

  private generateReference() {
    const year = new Date().getFullYear();
    const seq = Date.now().toString().slice(-6);
    return `ACH-${year}-${seq}`;
  }

  private calcTotals(items: any[], taxRate = 0, discount = 0) {
    const subtotal = items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      const itemDiscount = itemTotal * ((item.discount || 0) / 100);
      return sum + (itemTotal - itemDiscount);
    }, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount - discount;
    return { subtotal, taxAmount, total };
  }

  async create(dto: CreatePurchaseDto, userId: string) {
    const { items, supplierId, taxRate = 0, discount = 0, notes, expectedDate } = dto;

    // Validate products exist
    for (const item of items) {
      const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new NotFoundException(`Produit ${item.productId} non trouvé`);
    }

    const { subtotal, taxAmount, total } = this.calcTotals(items, taxRate, discount);

    return this.prisma.purchase.create({
      data: {
        reference: this.generateReference(),
        supplierId,
        userId,
        taxRate,
        taxAmount,
        discount,
        subtotal,
        total,
        amountDue: total,
        notes,
        expectedDate: expectedDate ? new Date(expectedDate) : undefined,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
          })),
        },
      },
      include: { supplier: true, items: { include: { product: true } }, user: { select: { firstName: true, lastName: true } } },
    });
  }

  async findAll(query: QueryPurchaseDto) {
    const { supplierId, status, startDate, endDate, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where, skip, take: Number(limit),
        include: { supplier: true, _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return { data, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
  }

  async findOne(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: { product: { include: { category: true } } } },
        payments: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!purchase) throw new NotFoundException('Achat non trouvé');
    return purchase;
  }

  async update(id: string, dto: UpdatePurchaseDto) {
    const purchase = await this.findOne(id);
    if (purchase.status === 'RECEIVED') throw new BadRequestException('Achat déjà reçu, modification impossible');
    if (purchase.status === 'CANCELLED') throw new BadRequestException('Achat annulé');
    const { supplierId, ...rest } = dto as any;
    return this.prisma.purchase.update({ where: { id }, data: { ...rest, ...(supplierId ? { supplierId } : {}) }, include: { supplier: true } });
  }

  async confirm(id: string) {
    const purchase = await this.findOne(id);
    if (purchase.status !== 'DRAFT') throw new BadRequestException('Seuls les brouillons peuvent être confirmés');
    const [updatedPurchase] = await this.prisma.$transaction([
      this.prisma.purchase.update({ where: { id }, data: { status: 'ORDERED' }, include: { supplier: true } }),
      this.prisma.supplier.update({
        where: { id: purchase.supplierId },
        data: { balance: { increment: purchase.amountDue } },
      }),
    ]);

    return updatedPurchase;
  }

  async receive(id: string, dto: ReceivePurchaseDto, userId: string) {
    const purchase = await this.findOne(id);
    if (!['ORDERED', 'PARTIAL'].includes(purchase.status)) {
      throw new BadRequestException('Statut invalide pour réception');
    }

    // Update received quantities and stock
    for (const recv of dto.items) {
      const purchaseItem = await this.prisma.purchaseItem.findUnique({ where: { id: recv.purchaseItemId } });
      if (!purchaseItem) continue;

      const newReceived = purchaseItem.received + recv.received;
      if (newReceived > purchaseItem.quantity) throw new BadRequestException('Quantité reçue dépasse la commande');

      await this.prisma.$transaction([
        this.prisma.purchaseItem.update({ where: { id: recv.purchaseItemId }, data: { received: newReceived } }),
        this.prisma.product.update({
          where: { id: purchaseItem.productId },
          data: { currentStock: { increment: recv.received } },
        }),
        this.prisma.stockMovement.create({
          data: {
            productId: purchaseItem.productId,
            type: 'PURCHASE',
            quantity: recv.received,
            unitCost: purchaseItem.unitPrice,
            reference: purchase.reference,
            userId,
          },
        }),
      ]);
    }

    // Check if fully received
    const updatedItems = await this.prisma.purchaseItem.findMany({ where: { purchaseId: id } });
    const fullyReceived = updatedItems.every(item => item.received >= item.quantity);

    await this.prisma.purchase.update({
      where: { id },
      data: { status: fullyReceived ? 'RECEIVED' : 'PARTIAL', receivedDate: fullyReceived ? new Date() : undefined },
    });

    return this.findOne(id);
  }

  async cancel(id: string) {
    const purchase = await this.findOne(id);
    if (purchase.status === 'RECEIVED') throw new BadRequestException('Impossible d\'annuler un achat reçu');
    const operations: any[] = [
      this.prisma.purchase.update({ where: { id }, data: { status: 'CANCELLED' } }),
    ];

    if (purchase.status !== 'DRAFT' && purchase.amountDue > 0) {
      operations.push(this.prisma.supplier.update({
        where: { id: purchase.supplierId },
        data: { balance: { decrement: purchase.amountDue } },
      }));
    }

    const [updatedPurchase] = await this.prisma.$transaction(operations);
    return updatedPurchase;
  }
}
