import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secret) {
      this.logger.warn('STRIPE_SECRET_KEY not set — Connect onboard will fail until configured');
    } else {
      this.stripe = new Stripe(secret);
    }
  }

  private client(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'STRIPE_SECRET_KEY not configured',
      );
    }
    return this.stripe;
  }

  /**
   * Creates Express connected account for shop (if missing).
   */
  async createConnectedAccount(shopId: string, email: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new BadRequestException('Shop not found');

    if (shop.stripeAccountId) {
      return { accountId: shop.stripeAccountId, alreadyExists: true };
    }

    const stripe = this.client();
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'company',
      metadata: { shopId },
    });

    const status =
      account.requirements?.disabled_reason ||
      (account.charges_enabled ? 'enabled' : 'pending');

    await this.prisma.shop.update({
      where: { id: shopId },
      data: {
        stripeAccountId: account.id,
        stripeAccountStatus: status,
        detailsSubmitted: account.details_submitted ?? false,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
      },
    });

    await this.prisma.stripeConnectedAccount.upsert({
      where: { shopId },
      create: {
        shopId,
        stripeAccountId: account.id,
        type: 'express',
        status,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
        raw: account as unknown as Prisma.InputJsonValue,
      },
      update: {
        status,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
        raw: account as unknown as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      action: 'STRIPE_CONNECT_CREATE',
      entityType: 'Shop',
      entityId: shopId,
      meta: { stripeAccountId: account.id },
    });

    return { accountId: account.id, alreadyExists: false };
  }

  /**
   * Account onboarding link (KYC in Stripe-hosted flow).
   */
  async createAccountLink(
    shopId: string,
    refreshUrl: string,
    returnUrl: string,
  ) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop?.stripeAccountId) {
      throw new BadRequestException(
        'Shop has no Stripe account. Create it first.',
      );
    }

    const accountLink = await this.client().accountLinks.create({
      account: shop.stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return { url: accountLink.url };
  }

  /**
   * Pull latest Connect account status from Stripe into Shop.
   */
  async syncAccountStatus(shopId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop?.stripeAccountId) {
      return {
        connected: false,
        stripeAccountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        status: null,
      };
    }

    const account = await this.client().accounts.retrieve(shop.stripeAccountId);
    const status =
      account.requirements?.disabled_reason ||
      (account.charges_enabled ? 'enabled' : 'pending');

    const updated = await this.prisma.shop.update({
      where: { id: shopId },
      data: {
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
        stripeAccountStatus: status,
        stripeOnboardedAt: account.details_submitted
          ? shop.stripeOnboardedAt ?? new Date()
          : shop.stripeOnboardedAt,
      },
    });

    await this.prisma.stripeConnectedAccount.upsert({
      where: { shopId },
      create: {
        shopId,
        stripeAccountId: account.id,
        type: 'express',
        status,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
        raw: account as unknown as Prisma.InputJsonValue,
      },
      update: {
        status,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
        raw: account as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      connected: true,
      stripeAccountId: updated.stripeAccountId,
      chargesEnabled: updated.chargesEnabled,
      payoutsEnabled: updated.payoutsEnabled,
      detailsSubmitted: updated.detailsSubmitted,
      status: updated.stripeAccountStatus,
      stripeOnboardedAt: updated.stripeOnboardedAt,
    };
  }
}
