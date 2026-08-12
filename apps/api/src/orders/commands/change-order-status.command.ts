import { JwtPayload } from '../../auth/jwt-payload.interface';

export class ChangeOrderStatusCommand {
  constructor(
    public readonly orderId: string,
    public readonly newStatus: string,
    public readonly user: JwtPayload,
    public readonly comment?: string,
  ) {}
}
