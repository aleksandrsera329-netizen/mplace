import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CheckoutShippingDto {
  @IsString()
  rateId!: string;

  @IsOptional()
  @IsString()
  methodId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  daysMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  daysMax?: number;
}

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

  /** Selected shipping rate from POST /shipping/calculate */
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutShippingDto)
  shipping?: CheckoutShippingDto;

  /** Tax country for VAT/НДС (default RU) */
  @IsOptional()
  @IsString()
  taxCountry?: string;
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
