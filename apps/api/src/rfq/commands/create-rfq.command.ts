import { JwtPayload } from '../../auth/jwt-payload.interface';
import { CreateRfqDto } from '../dto/rfq.dto';

export class CreateRfqCommand {
  constructor(
    public readonly user: JwtPayload,
    public readonly dto: CreateRfqDto,
  ) {}
}
