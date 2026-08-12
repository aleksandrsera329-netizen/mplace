import { JwtPayload } from '../../auth/jwt-payload.interface';

export class RejectRfqResponseCommand {
  constructor(
    public readonly user: JwtPayload,
    public readonly rfqId: string,
    public readonly offerId: string,
    public readonly reason?: string,
  ) {}
}
