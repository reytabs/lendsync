import { moneyParts } from '@/lib/utils';

// Symbols that live in our display fonts (e.g. "$") render at the correct size
// already. Anything outside this set (e.g. the peso sign "₱") falls back to a
// mismatched system glyph, so we size-normalize it via `.money-symbol`.
const IN_FONT_SYMBOL = /^[A-Za-z$€£¥]+$/;

export function Money({
  cents,
  currency,
  className,
}: {
  cents: number;
  currency?: string;
  className?: string;
}) {
  const { symbol, value } = moneyParts(cents, currency);
  const needsNormalize = !IN_FONT_SYMBOL.test(symbol);
  return (
    <span className={className}>
      <span className={needsNormalize ? 'money-symbol' : undefined}>
        {symbol}
      </span>
      {value}
    </span>
  );
}
