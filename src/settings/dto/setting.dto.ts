import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class UpdateSettingDto {
  @ApiProperty() @IsString() key: string;
  @ApiProperty() @IsString() value: string;
}
export class BulkUpdateSettingsDto {
  @ApiProperty({ type: [UpdateSettingDto] }) settings: UpdateSettingDto[];
}
