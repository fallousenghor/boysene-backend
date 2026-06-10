import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingDto, BulkUpdateSettingsDto } from './dto/setting.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async findAll(group?: string) {
    const where = group ? { group } : {};
    const settings = await this.prisma.setting.findMany({ where, orderBy: { key: 'asc' } });
    // Return as map for easy consumption
    const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
    return { settings, map };
  }

  async get(key: string) {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  async update(dto: UpdateSettingDto) {
    return this.prisma.setting.upsert({
      where: { key: dto.key },
      update: { value: dto.value },
      create: { key: dto.key, value: dto.value },
    });
  }

  async bulkUpdate(dto: BulkUpdateSettingsDto) {
    const updates = await Promise.all(dto.settings.map(s => this.update(s)));
    return { updated: updates.length, settings: updates };
  }

  async getGroups() {
    const groups = await this.prisma.setting.findMany({ select: { group: true }, distinct: ['group'] });
    return groups.map(g => g.group);
  }
}
