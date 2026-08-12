import { JwtPayload } from '../../auth/jwt-payload.interface';
import { CheckoutDto } from '../dto/checkout.dto';

/** CQRS command: create order(s) from cart (checkout) */
export class CreateOrderCommand {
  constructor(
    public readonly user: JwtPayload | null,
    public readonly sessionKey: string | undefined,
    public readonly dto: CheckoutDto,
  ) {}
}
