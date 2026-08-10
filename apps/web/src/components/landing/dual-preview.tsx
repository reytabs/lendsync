'use client';

/**
 * Decorative dual-surface preview: staff console (left) + borrower portal (right).
 * Static markup only — not wired to live data.
 */
export function DualPreview() {
  return (
    <div
      aria-hidden
      className="relative grid h-full min-h-[520px] w-full grid-cols-1 overflow-hidden md:grid-cols-2"
    >
      <StaffPane />
      <BorrowerPane />
      {/* Soft blend at the seam so the two planes read as one composition */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-24 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#0a0b0e]/40 to-transparent md:block" />
    </div>
  );
}

function StaffPane() {
  return (
    <div className="relative border-b border-white/10 bg-[#0c0e14] md:border-b-0 md:border-r">
      <div className="flex gap-0">
        <div className="hidden w-[132px] shrink-0 border-r border-white/10 p-3 lg:block">
          <div className="mb-4 text-[10px] font-semibold tracking-wide text-white/70">
            LendSync
          </div>
          <div className="space-y-1 text-[10px]">
            {[
              { label: 'Dashboard', active: true },
              { label: 'Applications' },
              { label: 'Borrowers' },
              { label: 'Collections' },
              { label: 'Reports' },
            ].map((item) => (
              <div
                key={item.label}
                className={
                  item.active
                    ? 'rounded px-2 py-1.5 text-chart-gold bg-chart-gold/10'
                    : 'rounded px-2 py-1.5 text-white/40'
                }
              >
                {item.label}
              </div>
            ))}
          </div>
          <div className="mt-8 border-t border-white/10 pt-3 text-[9px] text-white/35">
            Jane Miller
            <div className="text-white/25">Underwriter</div>
          </div>
        </div>

        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-chart-gold/80">
            Staff console
          </div>
          <div className="mb-3 font-display text-sm font-semibold text-white/90">
            Dashboard
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
            {[
              { label: 'Applications', value: '248' },
              { label: 'Pending', value: '48' },
              { label: 'Approved', value: '36' },
              { label: 'Funded', value: '28' },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded border border-white/10 bg-white/[0.03] px-2.5 py-2"
              >
                <div className="text-[9px] uppercase tracking-wide text-white/40">
                  {kpi.label}
                </div>
                <div className="mt-0.5 font-mono text-sm text-white/90">
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-3 rounded border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 text-[10px] text-white/45">
              Applications overview
            </div>
            <svg viewBox="0 0 240 64" className="h-14 w-full" fill="none">
              <path
                d="M0 48 C30 46, 40 30, 60 34 C80 38, 90 18, 120 22 C150 26, 160 40, 180 28 C200 16, 220 20, 240 12"
                stroke="#D4A53C"
                strokeWidth="2"
              />
              <path
                d="M0 48 C30 46, 40 30, 60 34 C80 38, 90 18, 120 22 C150 26, 160 40, 180 28 C200 16, 220 20, 240 12 L240 64 L0 64 Z"
                fill="url(#staffFill)"
                opacity="0.35"
              />
              <defs>
                <linearGradient id="staffFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4A53C" />
                  <stop offset="100%" stopColor="#D4A53C" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="overflow-hidden rounded border border-white/10">
            <div className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr] gap-2 border-b border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[9px] uppercase tracking-wide text-white/35">
              <span>Borrower</span>
              <span>Type</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {[
              ['NorthBridge Co.', 'Business', '₱750K', 'Review'],
              ['Maria Santos', 'Personal', '₱120K', 'Approved'],
              ['David Torres', 'Auto', '₱340K', 'Pending'],
            ].map((row) => (
              <div
                key={row[0]}
                className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr] gap-2 border-b border-white/5 px-2.5 py-1.5 text-[10px] text-white/65 last:border-0"
              >
                <span className="truncate">{row[0]}</span>
                <span className="text-white/45">{row[1]}</span>
                <span className="font-mono">{row[2]}</span>
                <span className="text-chart-gold/90">{row[3]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BorrowerPane() {
  return (
    <div className="relative bg-[#10131a]">
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex gap-3 text-[10px] text-white/45">
            <span className="text-chart-gold">Dashboard</span>
            <span>My loan</span>
            <span>Documents</span>
          </div>
          <div className="text-[10px] text-white/40">Olivia Rhye</div>
        </div>

        <div className="mb-1 text-[10px] uppercase tracking-wider text-chart-teal/80">
          Borrower portal
        </div>
        <div className="mb-1 font-display text-sm font-semibold text-white/90">
          Welcome back, Olivia
        </div>
        <div className="mb-4 text-[11px] text-white/45">
          Here’s what’s happening with your loan.
        </div>

        <div className="mb-4 flex items-center gap-1">
          {[
            { label: 'Applied', done: true },
            { label: 'Review', done: true, current: true },
            { label: 'Decision', done: false },
            { label: 'Funding', done: false },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex flex-1 items-center gap-1">
              <div className="min-w-0 flex-1">
                <div
                  className={
                    step.done || step.current
                      ? 'h-1 rounded-full bg-chart-gold'
                      : 'h-1 rounded-full bg-white/10'
                  }
                />
                <div
                  className={
                    step.current
                      ? 'mt-1 truncate text-[9px] text-chart-gold'
                      : 'mt-1 truncate text-[9px] text-white/35'
                  }
                >
                  {step.label}
                </div>
              </div>
              {i < arr.length - 1 && <div className="w-1" />}
            </div>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          {[
            { label: 'Loan type', value: 'Personal' },
            { label: 'Amount', value: '₱25,000' },
            { label: 'Rate', value: '8.49%' },
            { label: 'Term', value: '60 mo' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded border border-white/10 bg-white/[0.03] px-2.5 py-2"
            >
              <div className="text-[9px] uppercase tracking-wide text-white/40">
                {item.label}
              </div>
              <div className="mt-0.5 font-mono text-xs text-white/85">
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-3 rounded border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 text-[10px] text-white/45">Your tasks</div>
          <div className="space-y-1.5 text-[10px]">
            {[
              { label: 'Verify your income', status: 'In progress' },
              { label: 'ID verification', status: 'Done' },
              { label: 'Bank account', status: 'Pending' },
            ].map((task) => (
              <div
                key={task.label}
                className="flex items-center justify-between gap-2 text-white/65"
              >
                <span>{task.label}</span>
                <span className="text-white/35">{task.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 text-[10px] text-white/45">Recent documents</div>
          <div className="space-y-1.5 text-[10px] text-white/60">
            <div>Pay stub · uploaded May 18</div>
            <div>Government ID · uploaded May 18</div>
            <div>Bank statement · uploaded May 19</div>
          </div>
        </div>
      </div>
    </div>
  );
}
