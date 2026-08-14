import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DemoRequestDto } from './dto/demo-request.dto';

export type LeadDelivery = {
  email: boolean;
  telegram: boolean;
  channels: string[];
};

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly config: ConfigService) {}

  private leadEmail(): string {
    return (
      this.config.get<string>('DEMO_LEAD_EMAIL') ||
      process.env.DEMO_LEAD_EMAIL ||
      'aleksandrsera329@gmail.com'
    );
  }

  async submitDemoRequest(dto: DemoRequestDto, meta?: { ip?: string; ua?: string }): Promise<LeadDelivery> {
    const channels: string[] = [];
    let emailOk = false;
    let telegramOk = false;

    const payload = {
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      company: (dto.company || '').trim(),
      role: dto.role || 'buyer',
      message: (dto.message || '').trim(),
      receivedAt: new Date().toISOString(),
      ip: meta?.ip || '',
      userAgent: (meta?.ua || '').slice(0, 300),
    };

    this.logger.log(
      `Demo request from ${payload.email} company=${payload.company || '-'} role=${payload.role}`,
    );

    try {
      emailOk = await this.sendViaFormSubmit(payload);
      if (emailOk) channels.push('email');
    } catch (e) {
      this.logger.warn(`FormSubmit email failed: ${(e as Error).message}`);
    }

    try {
      telegramOk = await this.sendViaTelegram(payload);
      if (telegramOk) channels.push('telegram');
    } catch (e) {
      this.logger.warn(`Telegram notify failed: ${(e as Error).message}`);
    }

    if (!emailOk && !telegramOk) {
      throw new ServiceUnavailableException(
        'Could not deliver demo request. Email/Telegram channels unavailable — try again or write aleksandrsera329@gmail.com directly.',
      );
    }

    return { email: emailOk, telegram: telegramOk, channels };
  }

  /** FormSubmit.co — free email relay (owner must confirm once via activation mail). */
  private async sendViaFormSubmit(payload: {
    name: string;
    email: string;
    company: string;
    role: string;
    message: string;
    receivedAt: string;
    ip: string;
  }): Promise<boolean> {
    const to = this.leadEmail();
    const subject = `Mplace Private Demo — ${payload.company || payload.name}`;
    const origin =
      this.config.get<string>('PUBLIC_DEMO_ORIGIN') ||
      process.env.PUBLIC_DEMO_ORIGIN ||
      'https://mplace-vu4o.onrender.com';

    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: origin,
        Referer: `${origin}/request-demo.html`,
      },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        company: payload.company,
        role: payload.role,
        message: payload.message || '(no notes)',
        _subject: subject,
        _template: 'table',
        _captcha: 'false',
        _replyto: payload.email,
        source: 'mplace-vu4o public demo form',
        receivedAt: payload.receivedAt,
        ip: payload.ip,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`FormSubmit HTTP ${res.status}: ${text.slice(0, 300)}`);
      return false;
    }
    try {
      const data = JSON.parse(text) as { success?: string | boolean };
      if (data.success === false) return false;
    } catch {
      /* non-JSON success body still ok if 200 */
    }
    this.logger.log(`Demo lead emailed via FormSubmit → ${to}`);
    return true;
  }

  private async sendViaTelegram(payload: {
    name: string;
    email: string;
    company: string;
    role: string;
    message: string;
    receivedAt: string;
  }): Promise<boolean> {
    const token =
      this.config.get<string>('TELEGRAM_BOT_TOKEN') || process.env.TELEGRAM_BOT_TOKEN;
    const chatId =
      this.config.get<string>('TELEGRAM_CHAT_ID') || process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return false;

    const text = [
      '🔔 *Mplace Private Demo request*',
      `Name: ${payload.name}`,
      `Email: ${payload.email}`,
      `Company: ${payload.company || '—'}`,
      `Role: ${payload.role}`,
      payload.message ? `Notes: ${payload.message}` : '',
      `At: ${payload.receivedAt}`,
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      this.logger.warn(`Telegram HTTP ${res.status}: ${t.slice(0, 300)}`);
      return false;
    }
    this.logger.log('Demo lead sent to Telegram');
    return true;
  }
}
