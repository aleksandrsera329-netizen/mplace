import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'APPROVE'
  | 'REJECT'
  | 'PAYMENT'
  | 'PAYOUT'
  | 'RFQ_CREATE'
  | 'RFQ_OFFER'
  | 'RFQ_AWARD'
  | string;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actorId?: string | null;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    ip?: string | null;
    meta?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId || null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId || null,
          ip: params.ip || null,
          // Prisma field is String? — store JSON
          meta: params.meta ? JSON.stringify(params.meta) : null,
        },
      });
    } catch (e) {
      // Never break the main request because of audit failure
      this.logger.error(
        `Audit log failed action=${params.action} entity=${params.entityType}`,
        e instanceof Error ? e.stack : String(e),
      );
    }
  }
}
