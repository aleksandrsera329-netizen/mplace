import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CheckoutDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  customerName?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;
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
