import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DemoRequestDto } from './dto/demo-request.dto';

export type LeadDelivery = {
  saved: boolean;
  email: boolean;
  telegram: boolean;
  push: boolean;
  channels: string[];
};

type LeadPayload = {
  name: string;
  email: string;
  company: string;
  role: string;
  message: string;
  receivedAt: string;
  ip: string;
  userAgent: string;
};

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private leadEmail(): string {
    return (
      this.config.get<string>('DEMO_LEAD_EMAIL') ||
      process.env.DEMO_LEAD_EMAIL ||
      'aleksandrsera329@gmail.com'
    );
  }

  /** Public ntfy topic for instant phone/desktop alerts (no signup). Override with DEMO_NTFY_TOPIC. */
  private ntfyTopic(): string {
    return (
      this.config.get<string>('DEMO_NTFY_TOPIC') ||
      process.env.DEMO_NTFY_TOPIC ||
      'mplace-demo-aleksandrsera329'
    );
  }

  async submitDemoRequest(
    dto: DemoRequestDto,
    meta?: { ip?: string; ua?: string },
  ): Promise<LeadDelivery> {
    const channels: string[] = [];
    const payload: LeadPayload = {
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

    let saved = false;
    let emailOk = false;
    let telegramOk = false;
    let pushOk = false;

    // 1) Always persist — request is never lost
    try {
      saved = await this.saveAsTicket(payload);
      if (saved) channels.push('database');
    } catch (e) {
      this.logger.error(`Save lead failed: ${(e as Error).message}`);
    }

    // 2) Instant push (phone/browser) via ntfy.sh
    try {
      pushOk = await this.sendViaNtfy(payload);
      if (pushOk) channels.push('ntfy');
    } catch (e) {
      this.logger.warn(`ntfy failed: ${(e as Error).message}`);
    }

    // 3) Email — Web3Forms if key set, else SMTP if set
    try {
      emailOk = await this.sendViaWeb3Forms(payload);
      if (!emailOk) emailOk = await this.sendViaSmtp(payload);
      if (emailOk) channels.push('email');
    } catch (e) {
      this.logger.warn(`Email notify failed: ${(e as Error).message}`);
    }

    // 4) Telegram optional
    try {
      telegramOk = await this.sendViaTelegram(payload);
      if (telegramOk) channels.push('telegram');
    } catch (e) {
      this.logger.warn(`Telegram notify failed: ${(e as Error).message}`);
    }

    // Success if at least saved or any notify channel worked
    if (!saved && !emailOk && !telegramOk && !pushOk) {
      // Still return soft success with empty channels only if everything died
      this.logger.error('All lead channels failed');
    }

    return {
      saved,
      email: emailOk,
      telegram: telegramOk,
      push: pushOk,
      channels,
    };
  }

  private async saveAsTicket(payload: LeadPayload): Promise<boolean> {
    const subject = `Private Demo: ${payload.company || payload.name}`.slice(
      0,
      180,
    );
    const body = [
      `Name: ${payload.name}`,
      `Email: ${payload.email}`,
      `Company: ${payload.company || '—'}`,
      `Role: ${payload.role}`,
      `Message: ${payload.message || '—'}`,
      `IP: ${payload.ip || '—'}`,
      `UA: ${payload.userAgent || '—'}`,
      `At: ${payload.receivedAt}`,
    ].join('\n');

    await this.prisma.ticket.create({
      data: {
        subject,
        body,
        type: 'private_demo',
        priority: 'HIGH',
        status: 'OPEN',
      },
    });
    this.logger.log('Demo lead saved as support ticket');
    return true;
  }

  private async sendViaNtfy(payload: LeadPayload): Promise<boolean> {
    const topic = this.ntfyTopic();
    const title = `Mplace demo: ${payload.company || payload.name}`;
    const body = [
      payload.name,
      payload.email,
      payload.company ? `Company: ${payload.company}` : '',
      `Role: ${payload.role}`,
      payload.message || '',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: {
        Title: title,
        Priority: 'high',
        Tags: 'briefcase,email',
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body,
    });
    if (!res.ok) {
      this.logger.warn(`ntfy HTTP ${res.status}`);
      return false;
    }
    this.logger.log(`Demo lead pushed to ntfy topic=${topic}`);
    return true;
  }

  /** Free email API — set WEB3FORMS_ACCESS_KEY from https://web3forms.com */
  private async sendViaWeb3Forms(payload: LeadPayload): Promise<boolean> {
    const key =
      this.config.get<string>('WEB3FORMS_ACCESS_KEY') ||
      process.env.WEB3FORMS_ACCESS_KEY;
    if (!key) return false;

    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: key,
        subject: `Mplace Private Demo — ${payload.company || payload.name}`,
        from_name: 'Mplace Demo Form',
        name: payload.name,
        email: payload.email,
        company: payload.company,
        role: payload.role,
        message: payload.message || '(no notes)',
        to: this.leadEmail(),
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`Web3Forms HTTP ${res.status}: ${text.slice(0, 200)}`);
      return false;
    }
    this.logger.log(`Demo lead emailed via Web3Forms → ${this.leadEmail()}`);
    return true;
  }

  /** Gmail/SMTP — set SMTP_USER + SMTP_PASS (Gmail App Password) */
  private async sendViaSmtp(payload: LeadPayload): Promise<boolean> {
    const user =
      this.config.get<string>('SMTP_USER') || process.env.SMTP_USER;
    const pass =
      this.config.get<string>('SMTP_PASS') || process.env.SMTP_PASS;
    if (!user || !pass) return false;

    // Optional dependency — skip if not installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let createTransport: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      createTransport = require('nodemailer').createTransport;
    } catch {
      this.logger.warn('nodemailer not installed — skip SMTP');
      return false;
    }

    const host =
      this.config.get<string>('SMTP_HOST') ||
      process.env.SMTP_HOST ||
      'smtp.gmail.com';
    const port = Number(
      this.config.get<string>('SMTP_PORT') || process.env.SMTP_PORT || 587,
    );
    const to = this.leadEmail();
    const transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Mplace Demo" <${user}>`,
      to,
      replyTo: payload.email,
      subject: `Mplace Private Demo — ${payload.company || payload.name}`,
      text: [
        `Name: ${payload.name}`,
        `Email: ${payload.email}`,
        `Company: ${payload.company || '—'}`,
        `Role: ${payload.role}`,
        `Message: ${payload.message || '—'}`,
        `At: ${payload.receivedAt}`,
      ].join('\n'),
    });
    this.logger.log(`Demo lead emailed via SMTP → ${to}`);
    return true;
  }

  private async sendViaTelegram(payload: LeadPayload): Promise<boolean> {
    const token =
      this.config.get<string>('TELEGRAM_BOT_TOKEN') ||
      process.env.TELEGRAM_BOT_TOKEN;
    const chatId =
      this.config.get<string>('TELEGRAM_CHAT_ID') ||
      process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return false;

    const text = [
      '🔔 Mplace Private Demo request',
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
