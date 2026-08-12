import { JwtPayload } from '../../auth/jwt-payload.interface';
import { CreateRfqOfferDto } from '../dto/rfq.dto';

export class RespondToRfqCommand {
  constructor(
    public readonly user: JwtPayload,
    public readonly rfqId: string,
    public readonly dto: CreateRfqOfferDto,
  ) {}
}
