import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  draft: 'bg-white/5 text-muted-foreground border-border',
  pending: 'bg-[#D4A53C]/15 text-[#D4A53C] border-[#D4A53C]/30',
  submitted: 'bg-[#D4A53C]/15 text-[#D4A53C] border-[#D4A53C]/30',
  under_review: 'bg-[#D4A53C]/15 text-[#D4A53C] border-[#D4A53C]/30',
  upcoming: 'bg-white/5 text-muted-foreground border-border',
  partial: 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30',
  overdue: 'bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30',
  paid: 'bg-[#4ADE80]/15 text-[#4ADE80] border-[#4ADE80]/30',
  verified: 'bg-[#4ADE80]/15 text-[#4ADE80] border-[#4ADE80]/30',
  unverified: 'bg-white/5 text-muted-foreground border-border',
  approved: 'bg-[#175CD3]/20 text-[#60A5FA] border-[#175CD3]/40',
  disbursed: 'bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/30',
  active: 'bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/30',
  rejected: 'bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30',
  closed: 'bg-white/5 text-muted-foreground border-border',
  completed: 'bg-[#4ADE80]/15 text-[#4ADE80] border-[#4ADE80]/30',
  defaulted: 'bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30',
};

const labels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  submitted: 'Pending',
  under_review: 'Pending',
  upcoming: 'Upcoming',
  partial: 'Partial',
  overdue: 'Overdue',
  paid: 'Paid',
  verified: 'Verified',
  unverified: 'Unverified',
  approved: 'Approved',
  disbursed: 'Disbursed',
  active: 'Active',
  rejected: 'Rejected',
  closed: 'Closed',
  completed: 'Closed',
  defaulted: 'Defaulted',
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        styles[key] ?? styles.closed,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[key] ?? status}
    </span>
  );
}
