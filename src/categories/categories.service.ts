import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}
  async create(dto: CreateCategoryDto) {
    const exists = await this.prisma.category.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Catégorie déjà existante');
    return this.prisma.category.create({ data: dto });
  }
  findAll() { return this.prisma.category.findMany({ include: { _count: { select: { products: true } } }, orderBy: { name: 'asc' } }); }
  async findOne(id: string) {
    const cat = await this.prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
    if (!cat) throw new NotFoundException('Catégorie non trouvée');
    return cat;
  }
  async update(id: string, dto: UpdateCategoryDto) { await this.findOne(id); return this.prisma.category.update({ where: { id }, data: dto }); }
  async remove(id: string) { await this.findOne(id); await this.prisma.category.delete({ where: { id } }); return { message: 'Catégorie supprimée' }; }
}
