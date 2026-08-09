import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guards';
import { OrgsService } from './orgs.service';
import { SignupDto, SwitchOrgDto } from './orgs.dto';

@ApiTags('orgs')
@Controller('orgs')
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  /** Public: create a new tenant + owner account. */
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.orgs.signup(dto);
  }

  @Get('mine')
  @UseGuards(AuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.orgs.listForProfile(user.id);
  }

  @Post('switch')
  @UseGuards(AuthGuard)
  switch(@CurrentUser() user: AuthUser, @Body() dto: SwitchOrgDto) {
    return this.orgs.switchOrg(user.id, dto.organizationId);
  }
}
