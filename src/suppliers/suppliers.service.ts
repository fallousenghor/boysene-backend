import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto, QuerySupplierDto } from './dto/supplier.dto';
@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}
  private generateCode() { return `FRN-${Date.now().toString().slice(-6)}`; }
  async create(dto: CreateSupplierDto) { return this.prisma.supplier.create({ data: { ...dto, code: this.generateCode() } }); }
  async findAll(query: QuerySupplierDto) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }, { code: { contains: search, mode: 'insensitive' } }];
    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      this.prisma.supplier.count({ where }),
    ]);
    return { data, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
  }
  async findOne(id: string) {
    const s = await this.prisma.supplier.findUnique({ where: { id }, include: { _count: { select: { purchases: true } } } });
    if (!s) throw new NotFoundException('Fournisseur non trouvé');
    return s;
  }
  async update(id: string, dto: UpdateSupplierDto) { await this.findOne(id); return this.prisma.supplier.update({ where: { id }, data: dto }); }
  async remove(id: string) { await this.findOne(id); await this.prisma.supplier.delete({ where: { id } }); return { message: 'Fournisseur supprimé' }; }
  async getHistory(id: string) {
    await this.findOne(id);
    const [purchases, payments] = await Promise.all([
      this.prisma.purchase.findMany({ where: { supplierId: id }, include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.payment.findMany({ where: { supplierId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return { purchases, payments };
  }
}
