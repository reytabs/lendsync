import type { AmortizationRow, EmiPreview, InterestMethod } from '@lms/types';

/** Round half-up to nearest cent. */
export function roundCents(value: number): number {
  return Math.round(value);
}

export function formatMoney(
  cents: number,
  currency = 'USD',
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/**
 * Reducing-balance EMI: P * r * (1+r)^n / ((1+r)^n - 1)
 * Flat-rate: total interest = P * annualRate * years; EMI = (P + interest) / n
 */
export function calculateEmi(params: {
  principalCents: number;
  annualRatePercent: number;
  tenureMonths: number;
  interestMethod?: InterestMethod;
  startDate?: Date;
}): EmiPreview {
  const {
    principalCents,
    annualRatePercent,
    tenureMonths,
    interestMethod = 'reducing',
    startDate = new Date(),
  } = params;

  if (principalCents <= 0 || tenureMonths <= 0) {
    throw new Error('Principal and tenure must be positive');
  }

  const schedule: AmortizationRow[] = [];
  let monthlyEmiCents = 0;
  let totalInterestCents = 0;

  if (interestMethod === 'flat') {
    const years = tenureMonths / 12;
    totalInterestCents = roundCents(
      principalCents * (annualRatePercent / 100) * years,
    );
    const totalRepayment = principalCents + totalInterestCents;
    monthlyEmiCents = roundCents(totalRepayment / tenureMonths);
    let balance = totalRepayment;
    const principalPerMonth = roundCents(principalCents / tenureMonths);
    for (let month = 1; month <= tenureMonths; month++) {
      const interest = roundCents(
        month === tenureMonths
          ? totalInterestCents - (monthlyEmiCents - principalPerMonth) * (tenureMonths - 1)
          : monthlyEmiCents - principalPerMonth,
      );
      const principal =
        month === tenureMonths
          ? balance - interest
          : principalPerMonth;
      const payment = principal + interest;
      balance = Math.max(0, balance - payment);
      const due = new Date(startDate);
      due.setMonth(due.getMonth() + month);
      schedule.push({
        month,
        dueDate: due.toISOString().slice(0, 10),
        paymentCents: payment,
        principalCents: principal,
        interestCents: interest,
        balanceCents: balance,
      });
    }
  } else {
    const monthlyRate = annualRatePercent / 100 / 12;
    if (monthlyRate === 0) {
      monthlyEmiCents = roundCents(principalCents / tenureMonths);
    } else {
      const factor = Math.pow(1 + monthlyRate, tenureMonths);
      monthlyEmiCents = roundCents(
        (principalCents * monthlyRate * factor) / (factor - 1),
      );
    }

    let balance = principalCents;
    for (let month = 1; month <= tenureMonths; month++) {
      const interest = roundCents(balance * monthlyRate);
      let principal = monthlyEmiCents - interest;
      if (month === tenureMonths || principal > balance) {
        principal = balance;
      }
      const payment = principal + interest;
      balance = Math.max(0, balance - principal);
      totalInterestCents += interest;
      const due = new Date(startDate);
      due.setMonth(due.getMonth() + month);
      schedule.push({
        month,
        dueDate: due.toISOString().slice(0, 10),
        paymentCents: payment,
        principalCents: principal,
        interestCents: interest,
        balanceCents: balance,
      });
    }
  }

  const totalRepaymentCents = schedule.reduce((s, r) => s + r.paymentCents, 0);
  if (interestMethod === 'reducing') {
    totalInterestCents = totalRepaymentCents - principalCents;
  }

  return {
    monthlyEmiCents,
    totalRepaymentCents,
    totalInterestCents,
    schedule,
  };
}

export function creditScoreBand(
  score: number,
): 'poor' | 'fair' | 'good' | 'excellent' {
  if (score < 580) return 'poor';
  if (score < 670) return 'fair';
  if (score < 750) return 'good';
  return 'excellent';
}

export function creditScoreColor(score: number): string {
  const band = creditScoreBand(score);
  if (band === 'poor') return '#F87171';
  if (band === 'fair') return '#D4A53C';
  if (band === 'good') return '#2DD4BF';
  return '#4ADE80';
}
