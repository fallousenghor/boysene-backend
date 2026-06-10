import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMovementDto, AdjustStockDto, QueryMovementDto } from './dto/stock.dto';

@Injectable()
export class StocksService {
  constructor(private prisma: PrismaService) {}

  async addMovement(dto: CreateMovementDto, userId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Produit non trouvé');

    const outgoingTypes = ['SALE', 'RETURN_OUT', 'DAMAGE', 'TRANSFER'];
    const isIncoming = ['PURCHASE', 'RETURN_IN'].includes(dto.type);
    const quantityChange = isIncoming ? dto.quantity : -dto.quantity;

    const movement = await this.prisma.$transaction(async (tx) => {
      if (outgoingTypes.includes(dto.type)) {
        const updated = await tx.product.updateMany({
          where: { id: dto.productId, currentStock: { gte: dto.quantity } },
          data: { currentStock: { increment: quantityChange } },
        });

        if (updated.count !== 1) {
          throw new BadRequestException(`Stock insuffisant. Disponible: ${product.currentStock}`);
        }
      } else {
        await tx.product.update({
          where: { id: dto.productId },
          data: { currentStock: { increment: quantityChange } },
        });
      }

      return tx.stockMovement.create({
        data: { ...dto, userId },
        include: { product: true, user: { select: { firstName: true, lastName: true } } },
      });
    });

    return movement;
  }

  async adjustStock(dto: AdjustStockDto, userId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Produit non trouvé');

    const diff = dto.newQuantity - product.currentStock;
    const isIncrease = diff >= 0;
    const direction = isIncrease ? '+' : '-';

    const [movement] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          productId: dto.productId,
          type: 'ADJUSTMENT',
          quantity: Math.abs(diff),
          reason: `${direction}${Math.abs(diff)} - ${dto.reason || 'Ajustement manuel'}`,
          userId,
        },
      }),
      this.prisma.product.update({
        where: { id: dto.productId },
        data: { currentStock: dto.newQuantity },
      }),
    ]);

    return movement;
  }

  async getMovements(query: QueryMovementDto) {
    const { productId, type, startDate, endDate, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (productId) where.productId = productId;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where, skip, take: Number(limit),
        include: {
          product: { select: { name: true, reference: true, unit: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { data, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
  }

  async getInventory(query?: any) {
    const { search, categoryId, brandId, lowStock, page = 1, limit = 20 } = query || {};
    const take = Number(limit) || 20;
    const skip = (Number(page) - 1) * take;

    const where: any = { status: 'ACTIVE' };

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { reference: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    // lowStock is handled after fetching because Prisma cannot compare two columns (currentStock <= minStock) directly

    // Note: Prisma doesn't allow referencing another field in where clause directly (currentStock <= minStock)
    // So we fetch matched products then filter by lowStock in JS when needed.
    let [items, total] = await Promise.all([
      this.prisma.product.findMany({ where, include: { category: true, brand: true }, orderBy: { name: 'asc' }, skip, take }),
      this.prisma.product.count({ where }),
    ]);

    // If lowStock filtering requested but DB couldn't express currentStock <= minStock, filter in-memory
    let products = items;
    if (lowStock) {
      // fetch all matching products (without pagination) to compute correct counts and pages when lowStock is applied
      const allMatched = await this.prisma.product.findMany({ where: { status: 'ACTIVE', ...(search ? { OR: where.OR } : {}), ...(categoryId ? { categoryId } : {}), ...(brandId ? { brandId } : {} ) }, include: { category: true, brand: true }, orderBy: { name: 'asc' } });
      const filtered = allMatched.filter(p => p.currentStock <= p.minStock);
      total = filtered.length;
      products = filtered.slice(skip, skip + take);
    }

    const totalValue = products.reduce((sum, p) => sum + p.currentStock * (p.buyPrice || 0), 0);
    const lowStockItems = products.filter(p => p.currentStock <= p.minStock);
    const outOfStock = products.filter(p => p.currentStock === 0);

    return {
      products,
      summary: {
        totalProducts: total,
        inventoryValue: totalValue,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStock.length,
      },
      meta: {
        total,
        page: Number(page),
        limit: take,
        pages: Math.ceil(total / take) || 1,
      },
    };
  }

  async getAlerts() {
    return this.prisma.$queryRaw`
      SELECT p.*, row_to_json(c.*) as category
      FROM products p
      JOIN categories c ON p."categoryId" = c.id
      WHERE p.status = 'ACTIVE'
      AND p."currentStock" <= p."minStock"
      ORDER BY p."currentStock" ASC
    `;
  }
}
