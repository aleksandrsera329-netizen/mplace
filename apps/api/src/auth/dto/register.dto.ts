import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterCustomerDto {
  @ValidateIf((o: RegisterCustomerDto) => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((o: RegisterCustomerDto) => !o.email)
  @IsString()
  @MinLength(8)
  phone?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}

export class RegisterMerchantDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  shopName!: string;

  @IsOptional()
  @IsString()
  shopSlug?: string;
}

export class PasswordResetRequestDto {
  @IsEmail()
  email!: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  token!: string;
}

export class Enable2faDto {
  @IsString()
  @MinLength(6)
  code!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
