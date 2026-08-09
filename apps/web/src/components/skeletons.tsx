import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Header row + body rows sized to a column count. Render inside a CardContent. */
export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  const template = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
  return (
    <div className="w-full">
      <div
        className="mb-4 grid gap-4 border-b border-border pb-2"
        style={template}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid items-center gap-4" style={template}>
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn('h-4', c === 0 ? 'w-3/4' : 'w-1/2')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="card-surface space-y-3 p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-2 h-3 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

/** Full-page skeleton for the staff dashboard: KPIs, two charts, a table. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCardSkeleton className="xl:col-span-2" />
        <ChartCardSkeleton />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={5} cols={6} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Full-page skeleton for reports: export button, KPIs, two charts. */
export function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}

/** Grid of profile cards (borrowers). */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-2 w-full" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Simple stacked form: labelled fields + submit button. */
export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

/** Borrower loan detail: header, three stat cards, schedule table. */
export function LoanDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={5} cols={6} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Borrower portal home: next-action banner, stat tiles, recent table. */
export function PortalHomeSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-28" />
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={5} cols={5} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Full-screen shell placeholder used by layout auth gates. */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar p-3 md:flex">
        <div className="mb-6 flex items-center gap-2 px-1 py-2">
          <Skeleton className="h-6 w-6 rounded-[4px]" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-20" />
          </div>
        </header>
        <main className="flex-1 p-6">
          <DashboardSkeleton />
        </main>
      </div>
    </div>
  );
}
