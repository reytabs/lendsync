import { cn, money, pct } from '@/lib/utils';

export function KpiCard({
  label,
  valueCents,
  valueText,
  hint,
  delta,
  deltaLabel = 'vs last month',
  icon,
}: {
  label: string;
  valueCents?: number;
  valueText?: string;
  hint: string;
  delta?: number | null;
  deltaLabel?: string;
  icon: React.ReactNode;
}) {
  const showDelta = delta != null && Number.isFinite(delta);
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="card-surface relative p-5">
      <div className="absolute right-4 top-4 text-primary/80">{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="money mt-2 text-2xl font-semibold text-foreground">
        {valueText ?? (valueCents != null ? money(valueCents) : '—')}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{hint}</span>
        {showDelta ? (
          <span
            className={cn(
              'font-medium',
              positive ? 'text-chart-green' : 'text-chart-red',
            )}
          >
            {pct(delta!)} {deltaLabel}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
