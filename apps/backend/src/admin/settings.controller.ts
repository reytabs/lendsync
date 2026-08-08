import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guards';
import { AdminService } from './admin.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly admin: AdminService) {}

  /** Non-sensitive settings any authenticated user (staff or borrower) may read. */
  @Get('public')
  async publicSettings() {
    const settings = (await this.admin.getSettings()) as {
      organization?: { name?: string; currency?: string };
    };
    return {
      organizationName: settings.organization?.name ?? 'LendSync',
      currency: settings.organization?.currency ?? 'USD',
    };
  }
}
