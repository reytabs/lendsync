import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AuthGuard,
  Org,
  Roles,
  RolesGuard,
} from '../auth/auth.guards';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  plans() {
    return this.billing.listPlans();
  }

  @Get('subscription')
  subscription(@Org() orgId: string) {
    return this.billing.getSubscription(orgId);
  }

  @Get('entitlements')
  entitlements(@Org() orgId: string) {
    return this.billing.entitlements(orgId);
  }

  @Post('checkout')
  @UseGuards(RolesGuard)
  @Roles('admin')
  checkout(@Org() orgId: string, @Body() body: { planCode: string }) {
    return this.billing.createCheckout(orgId, body.planCode);
  }

  // Dev-only shortcut to simulate a completed Stripe Checkout.
  @Post('activate')
  @UseGuards(RolesGuard)
  @Roles('admin')
  activate(@Org() orgId: string, @Body() body: { planCode: string }) {
    return this.billing.activatePlan(orgId, body.planCode);
  }
}
