import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEmi, roundCents } from '../dist/index.js';

describe('calculateEmi', () => {
  it('computes reducing-balance EMI for standard loan', () => {
    const result = calculateEmi({
      principalCents: 100_000_00,
      annualRatePercent: 12,
      tenureMonths: 12,
      interestMethod: 'reducing',
    });
    assert.ok(result.monthlyEmiCents > 0);
    assert.equal(result.schedule.length, 12);
    assert.equal(result.schedule[11].balanceCents, 0);
    assert.ok(result.totalInterestCents > 0);
  });

  it('handles zero interest', () => {
    const result = calculateEmi({
      principalCents: 12_000_00,
      annualRatePercent: 0,
      tenureMonths: 12,
    });
    assert.equal(result.monthlyEmiCents, 1_000_00);
    assert.equal(result.totalInterestCents, 0);
  });

  it('supports flat rate', () => {
    const result = calculateEmi({
      principalCents: 100_000_00,
      annualRatePercent: 10,
      tenureMonths: 12,
      interestMethod: 'flat',
    });
    assert.equal(result.schedule.length, 12);
    assert.equal(result.totalInterestCents, roundCents(100_000_00 * 0.1));
  });

  it('rejects invalid principal', () => {
    assert.throws(() =>
      calculateEmi({
        principalCents: 0,
        annualRatePercent: 10,
        tenureMonths: 12,
      }),
    );
  });
});
