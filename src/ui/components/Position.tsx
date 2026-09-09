import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, EyeOff } from 'lucide-react';
import type { PublicState } from '../useInformer';

const usd = (n: bigint) => `$${Number(n).toLocaleString('en-US')}`;

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

/**
 * Where a figure sits in the published distribution.
 *
 * Computed here in the browser from the public histogram. The figure is never
 * sent anywhere, and answering costs nothing, so a visitor gets the thing they
 * came for before being asked to connect a wallet.
 */
export default function Position({
  state,
  onContribute,
}: {
  state: PublicState | null;
  onContribute: () => void;
}) {
  const [value, setValue] = useState('');

  const result = useMemo(() => {
    if (!state || state.contributionCount === 0n) return null;
    let raw: bigint;
    try {
      raw = BigInt(value || '0');
    } catch {
      return null;
    }
    if (raw <= 0n) return null;

    const band = raw / state.bucketWidth;
    let below = 0n;
    let same = 0n;
    for (const b of state.buckets) {
      if (b.index < band) below += b.count;
      else if (b.index === band) same += b.count;
    }
    const total = Number(state.contributionCount);
    // Midpoint within the matching band, since banded data cannot rank inside it.
    const pct = ((Number(below) + Number(same) / 2) / total) * 100;
    return {
      band,
      low: band * state.bucketWidth,
      high: (band + 1n) * state.bucketWidth,
      percentile: Math.max(1, Math.min(99, Math.round(pct))),
      total,
    };
  }, [value, state]);

  const thin = state !== null && state.contributionCount < state.kAnonymityFloor;

  return (
    <div className="card p-7 md:p-9">
      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
        <div>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-2">
              Your annual total compensation
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-3.5 focus-within:border-volt/60 transition-colors">
              <span className="text-muted font-mono">$</span>
              <input
                type="number" inputMode="numeric" value={value} placeholder="72000"
                onChange={(e) => setValue(e.target.value)}
                aria-label="Your annual total compensation in US dollars"
                className="bg-transparent w-full text-xl font-semibold tabular-nums outline-none placeholder:text-muted/50"
              />
              <EyeOff size={15} className="text-muted shrink-0" aria-hidden />
            </div>
          </label>

          <p className="mt-4 text-sm text-muted leading-relaxed">
            Worked out in your browser against the published distribution. Nothing is
            transmitted, no wallet is involved, and this page never sees the number.
          </p>
        </div>

        <div className="min-h-[188px] flex flex-col justify-center">
          {!result ? (
            <p className="text-muted text-sm">
              {state && state.contributionCount === 0n
                ? 'No contributions yet, so there is nothing to compare against.'
                : 'Enter a figure to see where it sits.'}
            </p>
          ) : (
            <motion.div
              key={result.percentile}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
                  Your figure
                </span>
                <span className="font-semibold text-muted">private</span>
              </div>

              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-[clamp(2.6rem,6vw,4rem)] font-bold tracking-tightest leading-none tabular-nums">
                  {ordinal(result.percentile)}
                </span>
                <span className="text-muted">percentile</span>
              </div>

              <div className="mt-6" aria-hidden>
                <div className="relative h-2 rounded-full bg-ink/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.percentile}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-y-0 left-0 bg-volt rounded-full"
                  />
                </div>
                <div className="mt-2 flex justify-between text-[10px] font-mono text-muted">
                  <span>0</span><span>50</span><span>100</span>
                </div>
              </div>

              <p className="mt-5 text-sm text-muted leading-relaxed">
                Against {result.total} contribution{result.total === 1 ? '' : 's'}, in the{' '}
                {usd(result.low)} to {usd(result.high)} band.
                {thin && ' This survey is still small, so treat the position as indicative.'}
              </p>

              <button
                onClick={onContribute}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-volt px-6 py-3
                           font-semibold text-volt-ink hover:brightness-110 transition"
              >
                Add yours to the survey <ArrowRight size={16} aria-hidden />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
