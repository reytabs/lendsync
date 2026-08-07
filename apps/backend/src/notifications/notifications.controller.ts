import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable, interval, map, merge } from 'rxjs';
import {
  AuthGuard,
  CurrentUser,
  RolesGuard,
  type AuthUser,
} from '../auth/auth.guards';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.list(user, limit ? Number(limit) : 30);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user);
  }

  @Sse('stream')
  stream(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    const heartbeat$ = interval(25000).pipe(
      map(() => ({ data: { type: 'heartbeat' } }) as MessageEvent),
    );
    return merge(this.notifications.stream(user.id), heartbeat$);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }
}
