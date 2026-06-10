import { IsEmail, IsString, MinLength, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiProperty() @IsUUID() roleId: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class QueryUserDto {
  @ApiPropertyOptional() @IsOptional() search?: string;
  @ApiPropertyOptional() @IsOptional() roleId?: string;
  @ApiPropertyOptional() @IsOptional() page?: number = 1;
  @ApiPropertyOptional() @IsOptional() limit?: number = 10;
}
