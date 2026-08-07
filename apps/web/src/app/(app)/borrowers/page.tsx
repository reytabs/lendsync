'use client';

import { useMemo, useState } from 'react';
import { creditScoreColor } from '@lms/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { mockBorrowers } from '@/lib/mock-data';
import { money } from '@/lib/utils';

export default function BorrowersPage() {
  const [q, setQ] = useState('');
  const borrowers = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return mockBorrowers;
    return mockBorrowers.filter(
      (b) =>
        b.fullName.toLowerCase().includes(term) ||
        b.occupation.toLowerCase().includes(term),
    );
  }, [q]);

  return (
    <div className="space-y-4">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or occupation…"
        className="max-w-md"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {borrowers.map((b) => {
          const color = creditScoreColor(b.creditScore);
          const pct = ((b.creditScore - 300) / 550) * 100;
          return (
            <Card key={b.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-base font-semibold">
                      {b.fullName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.occupation} · since {b.since}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-muted-foreground">
                      Credit Score
                    </div>
                    <div className="money text-lg font-semibold" style={{ color }}>
                      {b.creditScore}
                    </div>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>Poor 300</span>
                  <span>Excellent 850</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                  <div>
                    <div className="money text-sm font-semibold">
                      {b.onTimeRate}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      On-time Rate
                    </div>
                  </div>
                  <div>
                    <div className="money text-sm font-semibold">
                      {money(b.totalBorrowedCents)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Total Borrowed
                    </div>
                  </div>
                  <div>
                    <div className="money text-sm font-semibold">
                      {b.activeLoans}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Active Loans
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
