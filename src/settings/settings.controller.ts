import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingDto, BulkUpdateSettingsDto } from './dto/setting.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
@ApiTags('settings') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}
  @Get() findAll(@Query('group') group?: string) { return this.settingsService.findAll(group); }
  @Get('groups') getGroups() { return this.settingsService.getGroups(); }
  @Get(':key') get(@Param('key') key: string) { return this.settingsService.get(key); }
  @Post() @UseGuards(RolesGuard) @Roles('ADMIN') update(@Body() dto: UpdateSettingDto) { return this.settingsService.update(dto); }
  @Post('bulk') @UseGuards(RolesGuard) @Roles('ADMIN') bulkUpdate(@Body() dto: BulkUpdateSettingsDto) { return this.settingsService.bulkUpdate(dto); }
}
