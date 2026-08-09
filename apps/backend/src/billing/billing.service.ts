import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';

export type PlanLimits = {
  seats: number; // -1 = unlimited
  active_loans: number;
  features: string[];
};

type PlanRow = {
  code: string;
  name: string;
  price_cents: number;
  interval: string;
  limits: PlanLimits;
};

type SubscriptionRow = {
  organization_id: string;
  plan_code: string | null;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  private get stripeEnabled() {
    return Boolean(this.config.get<string>('STRIPE_SECRET_KEY'));
  }

  listPlans() {
    return this.db.many<PlanRow>(
      `select code, name, price_cents, interval, limits
       from plans where is_active = true order by sort_order asc`,
    );
  }

  getSubscription(orgId: string) {
    return this.db.one<SubscriptionRow>(
      `select organization_id, plan_code, status, stripe_customer_id,
              stripe_subscription_id, current_period_end
       from subscriptions where organization_id = $1`,
      [orgId],
    );
  }

  /**
   * Live usage vs. plan limits. Counts run inside withTenant so RLS proves the
   * numbers are scoped to the caller's organization.
   */
  async entitlements(orgId: string) {
    const sub = await this.getSubscription(orgId);
    const plan = sub?.plan_code
      ? await this.db.one<PlanRow>(
          `select code, name, price_cents, interval, limits
           from plans where code = $1`,
          [sub.plan_code],
        )
      : null;

    const usage = await this.db.withTenant(orgId, async (tx) => {
      const seats = await tx.one<{ n: string }>(
        `select count(*)::text as n from memberships`,
      );
      const activeLoans = await tx.one<{ n: string }>(
        `select count(*)::text as n from loans
         where status in ('active', 'disbursed')`,
      );
      return {
        seats: Number(seats?.n ?? 0),
        active_loans: Number(activeLoans?.n ?? 0),
      };
    });

    const limits: PlanLimits = plan?.limits ?? {
      seats: 0,
      active_loans: 0,
      features: [],
    };
    const within = (used: number, limit: number) =>
      limit < 0 || used <= limit;

    return {
      status: sub?.status ?? 'incomplete',
      plan: plan
        ? { code: plan.code, name: plan.name, limits }
        : null,
      usage,
      withinLimits: {
        seats: within(usage.seats, limits.seats),
        active_loans: within(usage.active_loans, limits.active_loans),
      },
      features: limits.features ?? [],
      writable: ['trialing', 'active'].includes(sub?.status ?? ''),
    };
  }

  hasFeature(entitlements: { features: string[] }, feature: string) {
    return entitlements.features.includes(feature);
  }

  /**
   * Creates a Stripe Checkout session for the plan. Stubbed when no Stripe key
   * is configured so the flow is demonstrable locally.
   */
  async createCheckout(orgId: string, planCode: string) {
    const appUrl =
      this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    if (!this.stripeEnabled) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — returning stub checkout URL',
      );
      return {
        stub: true,
        url: `${appUrl}/billing/success?plan=${planCode}&org=${orgId}`,
      };
    }
    // Real Stripe Checkout would be created here using the plan's price id.
    return { stub: false, url: `${appUrl}/billing/success?plan=${planCode}` };
  }

  /** Dev/webhook helper to move a subscription onto a paid plan. */
  async activatePlan(orgId: string, planCode: string) {
    await this.db.query(
      `update subscriptions
         set plan_code = $2, status = 'active',
             current_period_end = now() + interval '30 days',
             updated_at = now()
       where organization_id = $1`,
      [orgId, planCode],
    );
    return this.getSubscription(orgId);
  }

  /**
   * Minimal webhook reducer. In production this verifies the Stripe signature
   * and maps event types → subscription state.
   */
  async handleWebhook(event: { type: string; orgId: string; planCode?: string }) {
    switch (event.type) {
      case 'checkout.session.completed':
        if (event.planCode) return this.activatePlan(event.orgId, event.planCode);
        return this.getSubscription(event.orgId);
      case 'invoice.payment_failed':
        await this.db.query(
          `update subscriptions set status = 'past_due', updated_at = now()
           where organization_id = $1`,
          [event.orgId],
        );
        return this.getSubscription(event.orgId);
      case 'customer.subscription.deleted':
        await this.db.query(
          `update subscriptions set status = 'canceled', updated_at = now()
           where organization_id = $1`,
          [event.orgId],
        );
        return this.getSubscription(event.orgId);
      default:
        this.logger.log(`Ignoring webhook event: ${event.type}`);
        return this.getSubscription(event.orgId);
    }
  }
}
