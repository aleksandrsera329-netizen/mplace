import { JwtPayload } from '../../auth/jwt-payload.interface';

export class CloseRfqCommand {
  constructor(
    public readonly user: JwtPayload,
    public readonly rfqId: string,
    public readonly reason?: string,
  ) {}
}
