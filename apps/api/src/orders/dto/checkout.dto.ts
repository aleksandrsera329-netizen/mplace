import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CheckoutDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  customerName?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  /** Free-text note from buyer (stored in status history reason) */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class UpdateOrderStatusDto {
  @IsString()
  status!: string;
}

export class PaymentTokenDto {
  @IsOptional()
  @IsString()
  paymentToken?: string;
}
