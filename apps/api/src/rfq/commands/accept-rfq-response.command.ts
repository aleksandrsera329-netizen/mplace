import { JwtPayload } from '../../auth/jwt-payload.interface';

export class AcceptRfqResponseCommand {
  constructor(
    public readonly user: JwtPayload,
    public readonly rfqId: string,
    public readonly offerId: string,
  ) {}
}
