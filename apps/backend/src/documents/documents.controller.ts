import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import {
  AuthGuard,
  CurrentUser,
  Roles,
  RolesGuard,
  type AuthUser,
} from '../auth/auth.guards';
import { DocumentsService } from './documents.service';

class CreateDocumentDto {
  @IsString()
  docType!: string;

  @IsString()
  storagePath!: string;

  @IsOptional()
  @IsUUID()
  applicationId?: string;
}

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.documents.list(user);
  }

  @Post()
  @Roles('borrower', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.documents.create(user, dto);
  }
}
