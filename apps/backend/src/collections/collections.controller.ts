import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import {
  AuthGuard,
  CurrentUser,
  Roles,
  RolesGuard,
  type AuthUser,
} from '../auth/auth.guards';
import { CollectionsService } from './collections.service';

class AssignDto {
  @IsOptional()
  @IsUUID()
  collectorId?: string | null;
}

class PromiseDto {
  @IsOptional()
  @IsString()
  promiseToPayDate?: string | null;
}

class NoteDto {
  @IsUUID()
  scheduleId!: string;

  @IsString()
  @MinLength(1)
  note!: string;

  @IsOptional()
  @IsIn(['call', 'sms', 'email', 'visit', 'other'])
  channel?: string;

  @IsOptional()
  @IsString()
  promiseToPayDate?: string;
}

@ApiTags('collections')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'loan_officer', 'collector', 'viewer')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get('queue')
  listQueue(@CurrentUser() user: AuthUser) {
    return this.collections.listQueue(user);
  }

  @Get('collectors')
  @Roles('admin', 'loan_officer', 'collector')
  listCollectors() {
    return this.collections.listCollectors();
  }

  @Get('notes/:scheduleId')
  listNotes(@Param('scheduleId') scheduleId: string) {
    return this.collections.listNotes(scheduleId);
  }

  @Patch(':scheduleId/assign')
  @Roles('admin', 'loan_officer', 'collector')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: AssignDto,
  ) {
    return this.collections.assignCollector(
      user,
      scheduleId,
      dto.collectorId ?? null,
    );
  }

  @Patch(':scheduleId/promise')
  @Roles('admin', 'loan_officer', 'collector')
  promise(
    @CurrentUser() user: AuthUser,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: PromiseDto,
  ) {
    return this.collections.setPromiseToPay(
      user,
      scheduleId,
      dto.promiseToPayDate ?? null,
    );
  }

  @Post('notes')
  @Roles('admin', 'loan_officer', 'collector')
  addNote(@CurrentUser() user: AuthUser, @Body() dto: NoteDto) {
    return this.collections.addNote(user, dto);
  }
}
