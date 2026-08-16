import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../auth/auth.guards';

export type SearchResultType =
  | 'borrower'
  | 'application'
  | 'loan'
  | 'staff';

export type SearchHit = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  meta?: Record<string, string | number | null>;
};

@Injectable()
export class SearchService {
  constructor(private readonly db: DatabaseService) {}

  async search(user: AuthUser, q: string, limit = 8): Promise<SearchHit[]> {
    const term = q.trim();
    if (term.length < 2) return [];

    const safeLimit = Math.min(Math.max(limit, 1), 20);
    const pattern = `%${term.replace(/[%_\\]/g, '\\$&')}%`;
    const canSeeBorrowers = ['admin', 'loan_officer', 'viewer'].includes(
      user.role,
    );
    const canSeeApps = ['admin', 'loan_officer', 'viewer'].includes(user.role);
    const canSeeLoans = [
      'admin',
      'loan_officer',
      'viewer',
      'collector',
    ].includes(user.role);
    const canSeeStaff = ['admin', 'loan_officer', 'viewer', 'collector'].includes(
      user.role,
    );

    const hits: SearchHit[] = [];

    if (canSeeBorrowers) {
      const borrowers = await this.db.many<{
        id: string;
        full_name: string;
        email: string;
        phone: string | null;
        kyc_status: string;
      }>(
        `select id, full_name, email, phone, kyc_status
         from profiles
         where role = 'borrower'
           and (
             full_name ilike $1 escape '\\'
             or email ilike $1 escape '\\'
             or coalesce(phone, '') ilike $1 escape '\\'
             or id::text ilike $1 escape '\\'
           )
         order by full_name
         limit $2`,
        [pattern, safeLimit],
      );
      for (const row of borrowers) {
        hits.push({
          type: 'borrower',
          id: row.id,
          title: row.full_name,
          subtitle: row.email + (row.phone ? ` · ${row.phone}` : ''),
          href: `/borrowers?q=${encodeURIComponent(row.full_name)}`,
          meta: { kycStatus: row.kyc_status },
        });
      }
    }

    if (canSeeApps) {
      const apps = await this.db.many<{
        id: string;
        status: string;
        loan_type: string;
        principal_cents: string | number;
        borrower_name: string;
        borrower_email: string;
      }>(
        `select a.id, a.status, a.loan_type, a.principal_cents,
                b.full_name as borrower_name, b.email as borrower_email
         from loan_applications a
         join profiles b on b.id = a.borrower_id
         where a.id::text ilike $1 escape '\\'
            or b.full_name ilike $1 escape '\\'
            or b.email ilike $1 escape '\\'
            or coalesce(a.purpose, '') ilike $1 escape '\\'
         order by a.created_at desc
         limit $2`,
        [pattern, safeLimit],
      );
      for (const row of apps) {
        hits.push({
          type: 'application',
          id: row.id,
          title: `${row.borrower_name} · ${row.loan_type.replace(/_/g, ' ')}`,
          subtitle: `App ${row.id.slice(0, 8)} · ${row.status}`,
          href: `/applications?id=${encodeURIComponent(row.id)}`,
          meta: {
            status: row.status,
            principalCents: Number(row.principal_cents),
          },
        });
      }
    }

    if (canSeeLoans) {
      const loans = await this.db.many<{
        id: string;
        application_id: string;
        status: string;
        loan_type: string;
        principal_cents: string | number;
        borrower_name: string;
        borrower_email: string;
      }>(
        `select l.id, l.application_id, l.status, l.loan_type, l.principal_cents,
                b.full_name as borrower_name, b.email as borrower_email
         from loans l
         join profiles b on b.id = l.borrower_id
         where l.id::text ilike $1 escape '\\'
            or l.application_id::text ilike $1 escape '\\'
            or b.full_name ilike $1 escape '\\'
            or b.email ilike $1 escape '\\'
         order by l.created_at desc
         limit $2`,
        [pattern, safeLimit],
      );
      for (const row of loans) {
        hits.push({
          type: 'loan',
          id: row.id,
          title: `${row.borrower_name} · LN-${row.id.slice(0, 8).toUpperCase()}`,
          subtitle: `${row.loan_type.replace(/_/g, ' ')} · ${row.status}`,
          href: `/repayments?loanId=${encodeURIComponent(row.id)}`,
          meta: {
            status: row.status,
            principalCents: Number(row.principal_cents),
            applicationId: row.application_id,
          },
        });
      }
    }

    if (canSeeStaff) {
      const staff = await this.db.many<{
        id: string;
        full_name: string;
        email: string;
        role: string;
        phone: string | null;
      }>(
        `select id, full_name, email, role, phone
         from profiles
         where role = any(array['collector','loan_officer','admin','viewer']::public.user_role[])
           and (
             full_name ilike $1 escape '\\'
             or email ilike $1 escape '\\'
             or coalesce(phone, '') ilike $1 escape '\\'
           )
         order by full_name
         limit $2`,
        [pattern, safeLimit],
      );
      for (const row of staff) {
        const href =
          row.role === 'collector'
            ? '/collections'
            : user.role === 'admin'
              ? '/admin'
              : '/dashboard';
        hits.push({
          type: 'staff',
          id: row.id,
          title: row.full_name,
          subtitle: `${row.role.replace(/_/g, ' ')} · ${row.email}`,
          href,
          meta: { role: row.role },
        });
      }
    }

    // Prefer exact-ish matches first, then cap overall results
    const lower = term.toLowerCase();
    hits.sort((a, b) => {
      const aScore =
        (a.title.toLowerCase().startsWith(lower) ? 2 : 0) +
        (a.title.toLowerCase().includes(lower) ? 1 : 0) +
        (a.id.toLowerCase().startsWith(lower) ? 2 : 0);
      const bScore =
        (b.title.toLowerCase().startsWith(lower) ? 2 : 0) +
        (b.title.toLowerCase().includes(lower) ? 1 : 0) +
        (b.id.toLowerCase().startsWith(lower) ? 2 : 0);
      return bScore - aScore;
    });

    return hits.slice(0, safeLimit * 2);
  }
}
