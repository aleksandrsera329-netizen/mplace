import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MediaVisibility } from '@prisma/client';

export class CreateMediaDto {
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @IsOptional()
  @IsString()
  shopId?: string;

  @IsOptional()
  @IsEnum(MediaVisibility)
  visibility?: MediaVisibility;
}
