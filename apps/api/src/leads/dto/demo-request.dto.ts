import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class DemoRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @IsOptional()
  @IsIn(['buyer', 'operator', 'vendor', 'other'])
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
