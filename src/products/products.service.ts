import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto, QueryProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private generateReference() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const prefix = chars[Math.floor(Math.random() * chars.length)] + chars[Math.floor(Math.random() * chars.length)];
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  }

  async create(dto: CreateProductDto) {
    if (dto.barcode) {
      const exists = await this.prisma.product.findUnique({ where: { barcode: dto.barcode } });
      if (exists) throw new ConflictException('Code-barres déjà utilisé');
    }
    return this.prisma.product.create({
      data: { ...dto, reference: this.generateReference() },
      include: { category: true, brand: true },
    });
  }

  async findAll(query: QueryProductDto) {
    const { search, categoryId, brandId, status, lowStock, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (status) where.status = status;
    if (lowStock) {
      // Filter products below their minimum stock threshold
      const lowStockProducts = await this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, minStock: true, currentStock: true },
      });
      const lowStockIds = lowStockProducts
        .filter(p => p.currentStock <= p.minStock)
        .map(p => p.id);
      where.id = { in: lowStockIds };
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where, skip, take: Number(limit),
        include: { category: true, brand: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        stockMovements: { take: 10, orderBy: { createdAt: 'desc' }, include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!product) throw new NotFoundException('Produit non trouvé');
    return product;
  }

  async findByBarcode(barcode: string) {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: { category: true, brand: true },
    });
    if (!product) throw new NotFoundException('Produit non trouvé');
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    if (dto.barcode) {
      const exists = await this.prisma.product.findFirst({ where: { barcode: dto.barcode, NOT: { id } } });
      if (exists) throw new ConflictException('Code-barres déjà utilisé');
    }
    return this.prisma.product.update({ where: { id }, data: dto, include: { category: true, brand: true } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
    return { message: 'Produit supprimé' };
  }

  async getLowStockProducts() {
    return this.prisma.$queryRaw`
      SELECT p.*, c.name as category_name
      FROM products p
      JOIN categories c ON p."categoryId" = c.id
      WHERE p."currentStock" <= p."minStock"
      AND p.status = 'ACTIVE'
      ORDER BY (p."currentStock" - p."minStock") ASC
    `;
  }

  async updateStock(productId: string, quantity: number) {
    return this.prisma.product.update({
      where: { id: productId },
      data: { currentStock: { increment: quantity } },
    });
  }
}
