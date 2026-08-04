import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type KycNotifyStatus = 'APPROVED' | 'REJECTED' | 'PENDING';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly config: ConfigService) {}

  private channel(): string {
    return this.config.get<string>('NOTIFICATION_CHANNEL') || 'log';
  }

  async sendKycStatus(params: {
    email: string;
    name?: string;
    status: KycNotifyStatus;
    reason?: string;
    shopName?: string;
  }) {
    const { email, name, status, reason, shopName } = params;

    this.logger.log(
      `[KYC ${status}] → ${email} (${name || 'no name'})${shopName ? ` shop=${shopName}` : ''}`,
    );

    if (status === 'REJECTED' && reason) {
      this.logger.log(`Reason: ${reason}`);
    }

    // Later: SendGrid / Resend / Telegram via NOTIFICATION_CHANNEL
    // await this.mailService.send(...)

    return {
      success: true,
      channel: this.channel(),
      sentTo: email,
      status,
    };
  }

  async sendEmailVerification(email: string, token: string) {
    const base =
      this.config.get<string>('APP_PUBLIC_URL') || 'http://127.0.0.1:8088';
    this.logger.log(
      `[EMAIL VERIFY] → ${email} | token=${token} | link=${base}/login.html?verify=${token}`,
    );
    return { success: true, channel: this.channel(), sentTo: email };
  }

  async sendPasswordReset(email: string, token: string) {
    const base =
      this.config.get<string>('APP_PUBLIC_URL') || 'http://127.0.0.1:8088';
    this.logger.log(
      `[PASSWORD RESET] → ${email} | token=${token} | link=${base}/login.html?reset=${token}`,
    );
    return { success: true, channel: this.channel(), sentTo: email };
  }
}
