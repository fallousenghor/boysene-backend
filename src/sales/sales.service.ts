import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto, UpdateSaleDto, QuerySaleDto, ConfirmSaleDto, RecordPaymentDto, QuickSaleDto, QuickSaleItemDto } from './dto/sale.dto';
import { ProductsService } from '../products/products.service';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  private generateReference() {
    const year = new Date().getFullYear();
    const seq = Date.now().toString().slice(-6);
    return `VNT-${year}-${seq}`;
  }

  private generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const seq = Date.now().toString().slice(-6);
    return `FAC-${year}-${seq}`;
  }

  private calculateTotals(items: any[], taxRate = 0, globalDiscount = 0) {
    const subtotal = items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice;
      const lineDiscount = lineTotal * ((item.discount || 0) / 100);
      return sum + (lineTotal - lineDiscount);
    }, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount - globalDiscount;
    return { subtotal, taxAmount, total };
  }

  // ─────────────────────────────────────────────
  // 1. CRÉATION - Créer un brouillon de vente
  // ─────────────────────────────────────────────
  async create(dto: CreateSaleDto, userId: string) {
    const { items, customerId, paymentType = 'CREDIT', taxRate = 0, discount = 0, notes } = dto;

    // Valider les articles
    if (!items || items.length === 0) {
      throw new BadRequestException('Une vente doit contenir au moins un article');
    }

    // Vérifier que les produits existent
    const productIds = items.map(item => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, currentStock: true },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('Un ou plusieurs produits sont introuvables');
    }

    // Calculer les totaux
    const { subtotal, taxAmount, total } = this.calculateTotals(items, taxRate, discount);

    // Créer la vente en brouillon (SANS déduire le stock)
    const sale = await this.prisma.sale.create({
      data: {
        reference: this.generateReference(),
        customerId: customerId || null,
        userId,
        status: 'DRAFT',
        paymentType,
        taxRate,
        taxAmount,
        discount,
        subtotal,
        total,
        amountPaid: 0,
        amountDue: total,
        notes,
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
      include: {
        customer: true,
        items: { include: { product: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });

    return sale;
  }

  // ─────────────────────────────────────────────
  // 2. MODIFICATION - Updater un brouillon
  // ─────────────────────────────────────────────
  async update(id: string, dto: UpdateSaleDto) {
    const sale = await this.findOne(id);

    if (sale.status !== 'DRAFT') {
      throw new BadRequestException('Impossible de modifier une vente qui n\'est pas en brouillon');
    }

    const { items, customerId, taxRate, discount, notes } = dto;

    // Recalculer les totaux si nécessaire
    const finalItems = items || sale.items;
    const finalTaxRate = taxRate ?? sale.taxRate;
    const finalDiscount = discount ?? sale.discount;

    const { subtotal, taxAmount, total } = this.calculateTotals(finalItems, finalTaxRate, finalDiscount);

    // Mettre à jour la vente
    const updatedSale = await this.prisma.sale.update({
      where: { id },
      data: {
        customerId: customerId ?? sale.customerId,
        taxRate: finalTaxRate,
        taxAmount,
        discount: finalDiscount,
        subtotal,
        total,
        amountDue: total,
        notes: notes ?? sale.notes,
      },
      include: {
        customer: true,
        items: { include: { product: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });

    // Mettre à jour les articles si fournis
    if (items) {
      await this.prisma.saleItem.deleteMany({ where: { saleId: id } });
      await this.prisma.saleItem.createMany({
        data: items.map(item => ({
          saleId: id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
        })),
      });
    }

    return updatedSale;
  }

  // ─────────────────────────────────────────────
  // 3. CONFIRMATION - Finaliser la vente
  // ─────────────────────────────────────────────
  async confirm(id: string, dto: ConfirmSaleDto, userId: string) {
    const sale = await this.findOne(id);

    if (sale.status !== 'DRAFT') {
      throw new BadRequestException('Seul un brouillon peut être confirmé');
    }

    return this.prisma.$transaction(async (tx) => {
      // Vérifier le stock disponible
      const productQuantities = new Map<string, number>();
      sale.items.forEach(item => {
        productQuantities.set(item.productId, (productQuantities.get(item.productId) || 0) + item.quantity);
      });

      for (const [productId, quantity] of productQuantities) {
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { name: true, currentStock: true },
        });
        if (!product || product.currentStock < quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour "${product?.name || productId}". Disponible: ${product?.currentStock || 0}`
          );
        }
      }

      // Déduire le stock
      for (const [productId, quantity] of productQuantities) {
        await tx.product.update({
          where: { id: productId },
          data: { currentStock: { decrement: quantity } },
        });
      }

      // Enregistrer les mouvements de stock
      await tx.stockMovement.createMany({
        data: sale.items.map(item => ({
          productId: item.productId,
          type: 'SALE',
          quantity: item.quantity,
          reference: sale.reference,
          userId,
        })),
      });

      // Déterminer le statut après paiement initial
      const amountPaid = dto.amountPaid || 0;
      const amountDue = sale.total - amountPaid;
      let newStatus: string;

      if (amountPaid >= sale.total) {
        newStatus = 'FULLY_PAID';
      } else if (amountPaid > 0) {
        newStatus = 'PARTIAL_PAID';
      } else {
        newStatus = 'CONFIRMED';
      }

      // Mettre à jour le statut de la vente
      const confirmedSale = await tx.sale.update({
        where: { id },
        data: {
          status: newStatus as any,
          amountPaid,
          amountDue,
          confirmedAt: new Date(),
        },
        include: {
          customer: true,
          items: { include: { product: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      });

      // Enregistrer le paiement initial s'il y a
      if (amountPaid > 0) {
        await tx.payment.create({
          data: {
            reference: `PAY-${Date.now()}`,
            type: 'INCOME',
            method: (dto.paymentMethod || 'CASH') as any,
            amount: amountPaid,
            saleId: id,
            customerId: sale.customerId,
          },
        });
      }

      // Mettre à jour le solde client si crédit
      if (amountDue > 0 && sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { balance: { increment: amountDue } },
        });
      }

      // Créer la facture automatiquement
      await tx.invoice.create({
        data: {
          number: this.generateInvoiceNumber(),
          type: 'SALE',
          status: newStatus === 'FULLY_PAID' ? 'PAID' : 'SENT',
          saleId: id,
          customerId: sale.customerId,
          subtotal: sale.subtotal,
          taxAmount: sale.taxAmount,
          discount: sale.discount,
          total: sale.total,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return confirmedSale;
    });
  }

  // ─────────────────────────────────────────────
  // 4. PAIEMENT - Enregistrer un paiement
  // ─────────────────────────────────────────────
  async recordPayment(saleId: string, dto: RecordPaymentDto, userId: string) {
    const sale = await this.findOne(saleId);

    // Vérifier que la vente est confirmée
    if (!['CONFIRMED', 'PARTIAL_PAID'].includes(sale.status)) {
      throw new BadRequestException('Vous ne pouvez payer que les ventes confirmées');
    }

    if (sale.status === 'FULLY_PAID') {
      throw new BadRequestException('Cette vente est déjà entièrement payée');
    }

    if (sale.status === 'CANCELLED') {
      throw new BadRequestException('Impossible de payer une vente annulée');
    }

    if (dto.amount > sale.amountDue) {
      throw new BadRequestException(`Montant invalide. Reste à payer: ${sale.amountDue}`);
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Le montant doit être > 0');
    }

    return this.prisma.$transaction(async (tx) => {
      // Enregistrer le paiement
      await tx.payment.create({
        data: {
          reference: `PAY-${Date.now()}`,
          type: 'INCOME',
          method: dto.paymentMethod as any,
          amount: dto.amount,
          saleId,
          customerId: sale.customerId,
          notes: dto.notes,
        },
      });

      // Calculer nouveau solde
      const newAmountPaid = sale.amountPaid + dto.amount;
      const newAmountDue = sale.total - newAmountPaid;
      const newStatus = newAmountDue <= 0 ? 'FULLY_PAID' : 'PARTIAL_PAID';

      // Mettre à jour la vente
      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newStatus as any,
        },
        include: {
          customer: true,
          items: { include: { product: true } },
          user: { select: { firstName: true, lastName: true } },
          payments: true,
        },
      });

      // Mettre à jour le solde du client
      if (sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { balance: { decrement: dto.amount } },
        });
      }

      // Mettre à jour le statut de la facture
      if (newStatus === 'FULLY_PAID') {
        await tx.invoice.updateMany({
          where: { saleId },
          data: { status: 'PAID' },
        });
      }

      return updatedSale;
    });
  }

  // ─────────────────────────────────────────────
  // 5. LECTURE - Lister et récupérer les ventes
  // ─────────────────────────────────────────────
  async findAll(query: QuerySaleDto) {
    const { customerId, userId, status, paymentType, startDate, endDate, search, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (paymentType) where.paymentType = paymentType;

    // Recherche par référence ou nom de client
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Filtrage par date
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate);
      if (endDate) where.saleDate.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          customer: { select: { name: true, phone: true, balance: true } },
          user: { select: { firstName: true, lastName: true } },
          _count: { select: { items: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: { include: { category: true } } } },
        payments: true,
        invoices: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!sale) throw new NotFoundException('Vente non trouvée');
    return sale;
  }

  // ─────────────────────────────────────────────
  // 6. ANNULATION - Annuler une vente
  // ─────────────────────────────────────────────
  async cancel(id: string, userId: string) {
    const sale = await this.findOne(id);

    // Vérifier que c'est possible d'annuler
    if (sale.status === 'CANCELLED') {
      throw new BadRequestException('Cette vente est déjà annulée');
    }

    if (sale.status === 'FULLY_PAID') {
      throw new BadRequestException('Impossible d\'annuler une vente entièrement payée. Créez un remboursement à la place.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Restituer le stock si la vente était confirmée
      if (!['DRAFT'].includes(sale.status)) {
        await Promise.all(
          sale.items.map(item =>
            tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { increment: item.quantity } },
            })
          )
        );

        // Enregistrer les mouvements de retour
        await tx.stockMovement.createMany({
          data: sale.items.map(item => ({
            productId: item.productId,
            type: 'RETURN_IN',
            quantity: item.quantity,
            reference: sale.reference,
            reason: 'Annulation vente',
            userId,
          })),
        });
      }

      // Recréditer le client si nécessaire
      if (sale.customerId && sale.amountDue > 0) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { balance: { decrement: sale.amountDue } },
        });
      }

      // Annuler la facture associée
      await tx.invoice.updateMany({
        where: { saleId: id },
        data: { status: 'CANCELLED' },
      });

      // Annuler la vente
      return tx.sale.update({
        where: { id },
        data: { status: 'CANCELLED', amountDue: 0 },
        include: {
          customer: true,
          items: { include: { product: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      });
    });
  }

  // ─────────────────────────────────────────────
  // QUICK SALE - Créer, confirmer et enregistrer paiement en un seul appel
  // ─────────────────────────────────────────────
  async quickSale(dto: QuickSaleDto, userId: string) {
    const { items, customerId, paymentMethod, taxRate = 0, discount = 0, notes } = dto;

    if (!items || items.length === 0) {
      throw new BadRequestException('Une vente doit contenir au moins un article');
    }

    // Résoudre les références produits (barcode ou ID)
    const resolvedItems = await this.prisma.$transaction(async (tx) => {
      const result: Array<{ productId: string; quantity: number; unitPrice: number; discount: number }> = [];

      for (const item of items) {
        let product: any;
        if (item.productRef.length < 20) {
          // Probablement un barcode
          product = await tx.product.findUnique({
            where: { barcode: item.productRef },
            select: { id: true, sellPrice: true, currentStock: true },
          });
        }
        if (!product) {
          // Essayer par ID
          product = await tx.product.findUnique({
            where: { id: item.productRef },
            select: { id: true, sellPrice: true, currentStock: true },
          });
        }
        if (!product) {
          throw new NotFoundException(`Produit non trouvé: ${item.productRef}`);
        }
        if (product.currentStock < item.quantity) {
          throw new BadRequestException(`Stock insuffisant pour le produit ${item.productRef}. Disponible: ${product.currentStock}`);
        }
        result.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? product.sellPrice,
          discount: item.discount ?? 0,
        });
      }
      return result;
    });

    // Calculer les totaux
    const { subtotal, taxAmount, total } = this.calculateTotals(
      resolvedItems.map(i => ({ ...i, productId: i.productId })),
      taxRate,
      discount
    );

    // Create, confirm et payment en une seule transaction
    return this.prisma.$transaction(async (tx) => {
      // 1. Créer la vente
      const sale = await tx.sale.create({
        data: {
          reference: this.generateReference(),
          customerId: customerId || null,
          userId,
          status: 'CONFIRMED',
          paymentType: 'CASH',
          taxRate,
          taxAmount,
          discount,
          subtotal,
          total,
          amountPaid: total,
          amountDue: 0,
          notes,
          items: {
            create: resolvedItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              total: item.quantity * item.unitPrice * (1 - item.discount / 100),
            })),
          },
        },
        include: {
          customer: true,
          items: { include: { product: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      });

      // 2. Déduire le stock
      const productQuantities = new Map<string, number>();
      sale.items.forEach(item => {
        productQuantities.set(item.productId, (productQuantities.get(item.productId) || 0) + item.quantity);
      });

      for (const [productId, quantity] of productQuantities) {
        await tx.product.update({
          where: { id: productId },
          data: { currentStock: { decrement: quantity } },
        });
      }

      // 3. Enregistrer les mouvements de stock
      await tx.stockMovement.createMany({
        data: sale.items.map(item => ({
          productId: item.productId,
          type: 'SALE',
          quantity: item.quantity,
          reference: sale.reference,
          userId,
        })),
      });

      // 4. Enregistrer le paiement
      await tx.payment.create({
        data: {
          reference: `PAY-${Date.now()}`,
          type: 'INCOME',
          method: paymentMethod as any,
          amount: total,
          saleId: sale.id,
          customerId: sale.customerId,
        },
      });

      // 5. Créer la facture
      await tx.invoice.create({
        data: {
          number: this.generateInvoiceNumber(),
          type: 'SALE',
          status: 'PAID',
          saleId: sale.id,
          customerId: sale.customerId,
          subtotal: sale.subtotal,
          taxAmount: sale.taxAmount,
          discount: sale.discount,
          total: sale.total,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return sale;
    });
  }
}
