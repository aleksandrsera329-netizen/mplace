import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  /** Email or phone */
  @ValidateIf((o: LoginDto) => !o.phone)
  @IsString()
  email?: string;

  @ValidateIf((o: LoginDto) => !o.email)
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  /** TOTP code when 2FA enabled */
  @IsOptional()
  @IsString()
  totpCode?: string;
}
