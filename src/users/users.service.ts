import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto/user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email déjà utilisé');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { ...dto, password: hashed },
      include: { role: true },
    });
    const { password, refreshToken, ...result } = user;
    return result;
  }

  async findAll(query: QueryUserDto) {
    const { search, roleId, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (roleId) where.roleId = roleId;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where, skip, take: Number(limit),
        include: { role: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map(({ password, refreshToken, ...u }) => u),
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    const { password, refreshToken, ...result } = user;
    return result;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    if (dto.password) dto.password = await bcrypt.hash(dto.password, 10);
    if (dto.email) {
      const exists = await this.prisma.user.findFirst({ where: { email: dto.email, NOT: { id } } });
      if (exists) throw new ConflictException('Email déjà utilisé');
    }
    const user = await this.prisma.user.update({
      where: { id }, data: dto, include: { role: true },
    });
    const { password, refreshToken, ...result } = user;
    return result;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Utilisateur supprimé' };
  }
}
