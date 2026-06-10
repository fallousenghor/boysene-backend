import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}
  async create(dto: CreateRoleDto) {
    const exists = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Rôle déjà existant');
    const { permissionIds, ...data } = dto;
    return this.prisma.role.create({
      data: { ...data, permissions: permissionIds?.length ? { create: permissionIds.map(id => ({ permissionId: id })) } : undefined },
      include: { permissions: { include: { permission: true } } },
    });
  }
  findAll() { return this.prisma.role.findMany({ include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } }); }
  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
    if (!role) throw new NotFoundException('Rôle non trouvé');
    return role;
  }
  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);
    const { permissionIds, ...data } = dto;
    if (permissionIds !== undefined) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissionIds.length) await this.prisma.rolePermission.createMany({ data: permissionIds.map(pid => ({ roleId: id, permissionId: pid })) });
    }
    return this.prisma.role.update({ where: { id }, data, include: { permissions: { include: { permission: true } } } });
  }
  async remove(id: string) { await this.findOne(id); await this.prisma.role.delete({ where: { id } }); return { message: 'Rôle supprimé' }; }
  findAllPermissions() { return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] }); }
}
