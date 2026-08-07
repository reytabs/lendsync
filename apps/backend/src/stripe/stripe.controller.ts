import {
  Controller,
  Headers,
  Post,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { DisbursementsService } from '../disbursements/disbursements.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class StripeController {
  private stripe: Stripe | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly disbursements: DisbursementsService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key && !key.includes('xxx')) {
      this.stripe = new Stripe(key);
    }
  }

  @Post('stripe')
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!this.stripe) {
      return { received: true, mode: 'simulated' };
    }
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret || !signature || !req.rawBody) {
      throw new BadRequestException('Invalid webhook');
    }
    const event = this.stripe.webhooks.constructEvent(
      req.rawBody,
      signature,
      secret,
    );

    if (
      event.type === 'payment_intent.succeeded' ||
      event.type === 'transfer.created' ||
      event.type === 'transfer.updated'
    ) {
      const obj = event.data.object as { metadata?: { loanId?: string }; id: string };
      const loanId = obj.metadata?.loanId;
      if (loanId) {
        await this.disbursements.markSucceeded(loanId, obj.id);
      }
    }

    return { received: true };
  }
}
