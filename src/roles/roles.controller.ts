import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
@ApiTags('roles') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN') @Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}
  @Get('permissions') findAllPermissions() { return this.rolesService.findAllPermissions(); }
  @Post() create(@Body() dto: CreateRoleDto) { return this.rolesService.create(dto); }
  @Get() findAll() { return this.rolesService.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.rolesService.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateRoleDto) { return this.rolesService.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.rolesService.remove(id); }
}
