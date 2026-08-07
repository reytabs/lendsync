import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** Demo-friendly aggregates with DB fallback to curated mock metrics matching Figma. */
@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  async dashboard() {
    try {
      const loans = await this.db.many<{
        principal_cents: string | number;
        status: string;
        disbursed_at: string | null;
        loan_type: string;
      }>('select principal_cents, status, disbursed_at, loan_type from loans');

      if (loans.length) {
        const active = loans.filter((l) =>
          ['active', 'disbursed', 'approved'].includes(l.status),
        );
        const totalPortfolioCents = active.reduce(
          (s, l) => s + Number(l.principal_cents),
          0,
        );
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const disbursedThisMonth = loans.filter(
          (l) => l.disbursed_at && new Date(l.disbursed_at) >= monthStart,
        );
        const disbursedThisMonthCents = disbursedThisMonth.reduce(
          (s, l) => s + Number(l.principal_cents),
          0,
        );

        const repayments = await this.db.many<{
          amount_cents: string | number;
          paid_at: string;
        }>('select amount_cents, paid_at from repayments');
        const today = now.toISOString().slice(0, 10);
        const todayPayments = repayments.filter((r) =>
          String(r.paid_at).startsWith(today),
        );
        const collectionsTodayCents = todayPayments.reduce(
          (s, r) => s + Number(r.amount_cents),
          0,
        );

        const overdue = await this.db.many<{ total_cents: string | number }>(
          `select total_cents from repayment_schedules where status = 'overdue'`,
        );
        const overdueCents = overdue.reduce(
          (s, r) => s + Number(r.total_cents),
          0,
        );
        const portfolioAtRiskPercent =
          totalPortfolioCents > 0
            ? Number(((overdueCents / totalPortfolioCents) * 100).toFixed(1))
            : 0;

        const byType: Record<string, number> = {};
        for (const l of loans) {
          byType[l.loan_type] =
            (byType[l.loan_type] ?? 0) + Number(l.principal_cents);
        }

        return {
          kpis: {
            totalPortfolioCents,
            activeLoans: active.length,
            portfolioDeltaPercent: 12.4,
            disbursedThisMonthCents,
            disbursementsCount: disbursedThisMonth.length,
            disbursedDeltaPercent: 8.1,
            collectionsTodayCents,
            paymentsCount: todayPayments.length,
            collectionsDeltaPercent: -3.2,
            portfolioAtRiskPercent,
            overdueCents,
            parDeltaPercent: 1.1,
          },
          portfolioBreakdown: Object.entries(byType).map(([type, cents]) => ({
            type,
            cents,
          })),
          recentApplications: await this.recentApplications(),
          series: this.mockSeries(),
        };
      }
    } catch {
      // fall through to mock
    }
    return this.mockDashboard();
  }

  async reportKpis() {
    return {
      avgLoanSizeCents: 82000_00,
      avgTenureMonths: 36,
      avgInterestRatePercent: 11.8,
      defaultRatePercent: 2.4,
      recoveryRatePercent: 91.2,
      niiThisMonthCents: 184000_00,
    };
  }

  async charts(_range?: string) {
    return {
      monthlyApplications: [
        { month: 'Sep', count: 42 },
        { month: 'Oct', count: 55 },
        { month: 'Nov', count: 48 },
        { month: 'Dec', count: 61 },
        { month: 'Jan', count: 70 },
        { month: 'Feb', count: 66 },
        { month: 'Mar', count: 74 },
        { month: 'Apr', count: 69 },
        { month: 'May', count: 82 },
        { month: 'Jun', count: 77 },
        { month: 'Jul', count: 88 },
        { month: 'Aug', count: 86 },
      ],
      repaymentQuality: [
        { month: 'Sep', onTime: 92, late: 6, default: 2 },
        { month: 'Oct', onTime: 91, late: 7, default: 2 },
        { month: 'Nov', onTime: 93, late: 5, default: 2 },
        { month: 'Dec', onTime: 90, late: 7, default: 3 },
        { month: 'Jan', onTime: 94, late: 4, default: 2 },
        { month: 'Feb', onTime: 93, late: 5, default: 2 },
        { month: 'Mar', onTime: 92, late: 6, default: 2 },
        { month: 'Apr', onTime: 91, late: 6, default: 3 },
        { month: 'May', onTime: 93, late: 5, default: 2 },
        { month: 'Jun', onTime: 92, late: 6, default: 2 },
        { month: 'Jul', onTime: 94, late: 4, default: 2 },
        { month: 'Aug', onTime: 93, late: 5, default: 2 },
      ],
      disbursementVsCollections: this.mockSeries(),
    };
  }

  async exportCsv() {
    const dash = await this.dashboard();
    const rows = [
      ['metric', 'value'],
      ['total_portfolio_cents', String(dash.kpis.totalPortfolioCents)],
      ['active_loans', String(dash.kpis.activeLoans)],
      ['par_percent', String(dash.kpis.portfolioAtRiskPercent)],
    ];
    return rows.map((r) => r.join(',')).join('\n');
  }

  private async recentApplications() {
    return this.db.many(
      `select a.id, a.principal_cents, a.status, a.loan_type, a.created_at, a.borrower_id,
              b.full_name as borrower, o.full_name as officer
       from loan_applications a
       join profiles b on b.id = a.borrower_id
       left join profiles o on o.id = a.officer_id
       order by a.created_at desc
       limit 8`,
    );
  }

  private mockSeries() {
    const months = [
      'Sep',
      'Oct',
      'Nov',
      'Dec',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
    ];
    return months.map((month, i) => ({
      month,
      disbursed: 180000 + i * 12000 + (i % 3) * 8000,
      collected: 150000 + i * 10000 + (i % 2) * 6000,
    }));
  }

  private mockDashboard() {
    return {
      kpis: {
        totalPortfolioCents: 2846600_00,
        activeLoans: 347,
        portfolioDeltaPercent: 12.4,
        disbursedThisMonthCents: 284000_00,
        disbursementsCount: 86,
        disbursedDeltaPercent: 8.1,
        collectionsTodayCents: 47200_00,
        paymentsCount: 148,
        collectionsDeltaPercent: -3.2,
        portfolioAtRiskPercent: 7.3,
        overdueCents: 207801_00,
        parDeltaPercent: 1.1,
      },
      portfolioBreakdown: [
        { type: 'business', cents: 996310_00 },
        { type: 'personal', cents: 797048_00 },
        { type: 'home_equity', cents: 626252_00 },
        { type: 'auto', cents: 284660_00 },
        { type: 'micro', cents: 142330_00 },
      ],
      recentApplications: [
        {
          id: 'LN-2024-0891',
          borrower: 'Maria Santos',
          loan_type: 'business',
          principal_cents: 75000_00,
          status: 'approved',
          officer: 'James Reyes',
          created_at: '2024-08-04',
        },
        {
          id: 'LN-2024-0890',
          borrower: 'David Torres',
          loan_type: 'home_equity',
          principal_cents: 250000_00,
          status: 'submitted',
          officer: null,
          created_at: '2024-08-04',
        },
      ],
      series: this.mockSeries(),
    };
  }
}
