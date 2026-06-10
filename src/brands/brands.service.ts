import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';
@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}
  async create(dto: CreateBrandDto) {
    const exists = await this.prisma.brand.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Marque déjà existante');
    return this.prisma.brand.create({ data: dto });
  }
  findAll() { return this.prisma.brand.findMany({ include: { _count: { select: { products: true } } }, orderBy: { name: 'asc' } }); }
  async findOne(id: string) {
    const b = await this.prisma.brand.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Marque non trouvée');
    return b;
  }
  async update(id: string, dto: UpdateBrandDto) { await this.findOne(id); return this.prisma.brand.update({ where: { id }, data: dto }); }
  async remove(id: string) { await this.findOne(id); await this.prisma.brand.delete({ where: { id } }); return { message: 'Marque supprimée' }; }
}
