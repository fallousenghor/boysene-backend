import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto, QueryCustomerDto } from './dto/customer.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  private generateCode() {
    return `CLT-${Date.now().toString().slice(-6)}`;
  }

  async create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: { ...dto, code: this.generateCode() },
    });
  }

  async findAll(query: QueryCustomerDto) {
    const { search, page = 1, limit = 10, isActive } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      this.prisma.customer.count({ where }),
    ]);

    return { data, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { sales: true, payments: true } },
      },
    });
    if (!customer) throw new NotFoundException('Client non trouvé');
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.customer.delete({ where: { id } });
    return { message: 'Client supprimé' };
  }

  async getHistory(id: string) {
    await this.findOne(id);
    const [sales, payments] = await Promise.all([
      this.prisma.sale.findMany({
        where: { customerId: id },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.payment.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { sales, payments };
  }
}
