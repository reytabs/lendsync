import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  AuthGuard,
  Roles,
  RolesGuard,
} from '../auth/auth.guards';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('loan_officer', 'admin')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard() {
    return this.reports.dashboard();
  }

  @Get('kpis')
  kpis() {
    return this.reports.reportKpis();
  }

  @Get('charts')
  charts(@Query('range') range?: string) {
    return this.reports.charts(range);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv')
  async exportCsv(@Res() res: Response) {
    const csv = await this.reports.exportCsv();
    res.setHeader('Content-Disposition', 'attachment; filename="lendsync-report.csv"');
    res.send(csv);
  }
}
