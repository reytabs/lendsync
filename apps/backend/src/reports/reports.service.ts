import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const TYPE_META: Record<string, { label: string; color: string }> = {
  business: { label: 'Business', color: '#D4A53C' },
  personal: { label: 'Personal', color: '#2DD4BF' },
  home_equity: { label: 'Home Equity', color: '#A78BFA' },
  auto: { label: 'Auto', color: '#4ADE80' },
  micro: { label: 'Micro', color: '#F87171' },
};

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' });
}

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  async dashboard() {
    const loans = await this.db.many<{
      principal_cents: string | number;
      status: string;
      disbursed_at: string | null;
      loan_type: string;
      created_at: string;
    }>(
      `select principal_cents, status, disbursed_at, loan_type, created_at
       from loans`,
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = monthStart;

    const active = loans.filter((l) =>
      ['active', 'disbursed', 'approved'].includes(l.status),
    );
    const totalPortfolioCents = active.reduce(
      (s, l) => s + Number(l.principal_cents),
      0,
    );

    // Approximate start-of-month portfolio: active loans that existed before this month
    const portfolioStartCents = active
      .filter((l) => new Date(l.created_at) < monthStart)
      .reduce((s, l) => s + Number(l.principal_cents), 0);

    const disbursedThisMonth = loans.filter(
      (l) => l.disbursed_at && new Date(l.disbursed_at) >= monthStart,
    );
    const disbursedLastMonth = loans.filter((l) => {
      if (!l.disbursed_at) return false;
      const d = new Date(l.disbursed_at);
      return d >= lastMonthStart && d < lastMonthEnd;
    });
    const disbursedThisMonthCents = disbursedThisMonth.reduce(
      (s, l) => s + Number(l.principal_cents),
      0,
    );
    const disbursedLastMonthCents = disbursedLastMonth.reduce(
      (s, l) => s + Number(l.principal_cents),
      0,
    );

    const repayments = await this.db.many<{
      amount_cents: string | number;
      paid_at: string;
    }>('select amount_cents, paid_at from repayments');

    const today = now.toISOString().slice(0, 10);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    const todayPayments = repayments.filter((r) =>
      String(r.paid_at).startsWith(today),
    );
    const yesterdayPayments = repayments.filter((r) =>
      String(r.paid_at).startsWith(yesterday),
    );
    const collectionsTodayCents = todayPayments.reduce(
      (s, r) => s + Number(r.amount_cents),
      0,
    );
    const collectionsYesterdayCents = yesterdayPayments.reduce(
      (s, r) => s + Number(r.amount_cents),
      0,
    );

    const collectionsThisMonthCents = repayments
      .filter((r) => new Date(r.paid_at) >= monthStart)
      .reduce((s, r) => s + Number(r.amount_cents), 0);
    const collectionsLastMonthCents = repayments
      .filter((r) => {
        const d = new Date(r.paid_at);
        return d >= lastMonthStart && d < lastMonthEnd;
      })
      .reduce((s, r) => s + Number(r.amount_cents), 0);

    const overdueRows = await this.db.many<{
      total_cents: string | number;
      paid_cents: string | number;
    }>(
      `select s.total_cents,
              coalesce((
                select sum(r.amount_cents) from repayments r where r.schedule_id = s.id
              ), 0) as paid_cents
       from repayment_schedules s
       where s.status in ('overdue', 'partial')
         and s.due_date < current_date`,
    );
    const overdueCents = overdueRows.reduce(
      (s, r) =>
        s + Math.max(0, Number(r.total_cents) - Number(r.paid_cents)),
      0,
    );
    const portfolioAtRiskPercent =
      totalPortfolioCents > 0
        ? Number(((overdueCents / totalPortfolioCents) * 100).toFixed(1))
        : 0;

    const byType: Record<string, number> = {};
    for (const l of active) {
      byType[l.loan_type] =
        (byType[l.loan_type] ?? 0) + Number(l.principal_cents);
    }
    const portfolioBreakdown = Object.entries(byType)
      .map(([type, cents]) => {
        const meta = TYPE_META[type] ?? {
          label: type,
          color: '#6A6C7E',
        };
        return {
          type,
          label: meta.label,
          color: meta.color,
          cents,
          percent:
            totalPortfolioCents > 0
              ? Number(((cents / totalPortfolioCents) * 100).toFixed(1))
              : 0,
        };
      })
      .sort((a, b) => b.cents - a.cents);

    return {
      kpis: {
        totalPortfolioCents,
        activeLoans: active.length,
        portfolioDeltaPercent: pctChange(
          totalPortfolioCents,
          portfolioStartCents,
        ),
        disbursedThisMonthCents,
        disbursementsCount: disbursedThisMonth.length,
        disbursedDeltaPercent: pctChange(
          disbursedThisMonthCents,
          disbursedLastMonthCents,
        ),
        collectionsTodayCents,
        paymentsCount: todayPayments.length,
        collectionsDeltaPercent: pctChange(
          collectionsTodayCents,
          collectionsYesterdayCents,
        ),
        collectionsThisMonthCents,
        collectionsMonthDeltaPercent: pctChange(
          collectionsThisMonthCents,
          collectionsLastMonthCents,
        ),
        portfolioAtRiskPercent,
        overdueCents,
        parDeltaPercent: null as number | null,
      },
      portfolioBreakdown,
      recentApplications: await this.recentApplications(),
      series: await this.liveSeries(),
    };
  }

  async reportKpis() {
    const dash = await this.dashboard();
    const loans = await this.db.many<{
      principal_cents: string | number;
      tenure_months: number;
      annual_rate_percent: string | number;
      status: string;
    }>('select principal_cents, tenure_months, annual_rate_percent, status from loans');

    const n = loans.length || 1;
    const avgLoanSizeCents = Math.round(
      loans.reduce((s, l) => s + Number(l.principal_cents), 0) / n,
    );
    const avgTenureMonths = Math.round(
      loans.reduce((s, l) => s + Number(l.tenure_months), 0) / n,
    );
    const avgInterestRatePercent = Number(
      (
        loans.reduce((s, l) => s + Number(l.annual_rate_percent), 0) / n
      ).toFixed(1),
    );
    const defaulted = loans.filter((l) => l.status === 'defaulted').length;
    const completed = loans.filter((l) =>
      ['completed', 'closed'].includes(l.status),
    ).length;
    const defaultRatePercent =
      loans.length > 0
        ? Number(((defaulted / loans.length) * 100).toFixed(1))
        : 0;
    const recoveryRatePercent =
      completed + defaulted > 0
        ? Number(((completed / (completed + defaulted)) * 100).toFixed(1))
        : 100;

    return {
      avgLoanSizeCents,
      avgTenureMonths,
      avgInterestRatePercent,
      defaultRatePercent,
      recoveryRatePercent,
      niiThisMonthCents: dash.kpis.collectionsThisMonthCents ?? 0,
      activeLoans: dash.kpis.activeLoans,
      totalPortfolioCents: dash.kpis.totalPortfolioCents,
    };
  }

  async charts(_range?: string) {
    const applications = await this.db.many<{ month: string; count: string }>(
      `select to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
              count(*)::text as count
       from loan_applications
       where created_at >= date_trunc('month', now()) - interval '11 months'
       group by 1
       order by 1`,
    );

    const quality = await this.db.many<{
      month: string;
      on_time: string;
      late: string;
      defaulted: string;
    }>(
      `select to_char(date_trunc('month', due_date), 'YYYY-MM') as month,
              count(*) filter (where status = 'paid')::text as on_time,
              count(*) filter (where status in ('overdue', 'partial'))::text as late,
              count(*) filter (where status = 'upcoming' and due_date < current_date)::text as defaulted
       from repayment_schedules
       where due_date >= date_trunc('month', now()) - interval '11 months'
         and due_date < date_trunc('month', now()) + interval '1 month'
       group by 1
       order by 1`,
    );

    const keys = this.lastTwelveMonthKeys();
    const appMap = Object.fromEntries(
      applications.map((r) => [r.month, Number(r.count)]),
    );
    const qMap = Object.fromEntries(
      quality.map((r) => [
        r.month,
        {
          onTime: Number(r.on_time),
          late: Number(r.late),
          default: Number(r.defaulted),
        },
      ]),
    );

    return {
      monthlyApplications: keys.map((k) => ({
        month: monthLabel(k),
        count: appMap[k] ?? 0,
      })),
      repaymentQuality: keys.map((k) => {
        const q = qMap[k] ?? { onTime: 0, late: 0, default: 0 };
        const total = q.onTime + q.late + q.default;
        if (total === 0) return { month: monthLabel(k), onTime: 0, late: 0, default: 0 };
        return {
          month: monthLabel(k),
          onTime: Math.round((q.onTime / total) * 100),
          late: Math.round((q.late / total) * 100),
          default: Math.round((q.default / total) * 100),
        };
      }),
      disbursementVsCollections: await this.liveSeries(),
    };
  }

  async exportCsv() {
    const dash = await this.dashboard();
    const rows = [
      ['metric', 'value'],
      ['total_portfolio_cents', String(dash.kpis.totalPortfolioCents)],
      ['active_loans', String(dash.kpis.activeLoans)],
      ['par_percent', String(dash.kpis.portfolioAtRiskPercent)],
      ['disbursed_this_month_cents', String(dash.kpis.disbursedThisMonthCents)],
      ['collections_today_cents', String(dash.kpis.collectionsTodayCents)],
      ['overdue_cents', String(dash.kpis.overdueCents)],
    ];
    return rows.map((r) => r.join(',')).join('\n');
  }

  private lastTwelveMonthKeys() {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(monthKey(d));
    }
    return keys;
  }

  private async liveSeries() {
    const keys = this.lastTwelveMonthKeys();

    const disbursed = await this.db.many<{
      month: string;
      total: string;
    }>(
      `select to_char(date_trunc('month', disbursed_at), 'YYYY-MM') as month,
              coalesce(sum(principal_cents), 0)::text as total
       from loans
       where disbursed_at is not null
         and disbursed_at >= date_trunc('month', now()) - interval '11 months'
       group by 1
       order by 1`,
    );

    const collected = await this.db.many<{
      month: string;
      total: string;
    }>(
      `select to_char(date_trunc('month', paid_at), 'YYYY-MM') as month,
              coalesce(sum(amount_cents), 0)::text as total
       from repayments
       where paid_at >= date_trunc('month', now()) - interval '11 months'
       group by 1
       order by 1`,
    );

    const dMap = Object.fromEntries(
      disbursed.map((r) => [r.month, Number(r.total) / 100]),
    );
    const cMap = Object.fromEntries(
      collected.map((r) => [r.month, Number(r.total) / 100]),
    );

    return keys.map((k) => ({
      month: monthLabel(k),
      disbursed: dMap[k] ?? 0,
      collected: cMap[k] ?? 0,
    }));
  }

  private async recentApplications() {
    return this.db.many(
      `select a.id, a.principal_cents, a.status, a.loan_type, a.created_at,
              b.full_name as borrower, o.full_name as officer
       from loan_applications a
       join profiles b on b.id = a.borrower_id
       left join profiles o on o.id = a.officer_id
       order by a.created_at desc
       limit 8`,
    );
  }
}
