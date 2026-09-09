import { motion } from 'framer-motion';
import type { PublicState } from '../useInformer';

const usd = (n: bigint) => `$${Number(n).toLocaleString('en-US')}`;
const short = (n: bigint) => `$${Math.round(Number(n) / 1000)}k`;

type Props = {
  state: PublicState | null;
  /** The band the viewer just contributed to, highlighted without naming a figure. */
  highlight?: bigint | null;
};

/**
 * The public distribution, read from ledger state.
 *
 * Every bar is a band and a count. There is no series here that could carry an
 * individual figure, because the contract has no field that holds one.
 */
export default function Distribution({ state, highlight = null }: Props) {
  if (!state) {
    return (
      <div className="h-56 flex items-center text-sm text-muted font-mono">
        Reading ledger state…
      </div>
    );
  }

  const width = state.bucketWidth;
  const present = new Map(state.buckets.map((b) => [b.index, b.count]));
  const indices = state.buckets.map((b) => b.index);

  // Always render a window of bands so an early distribution still reads as a
  // distribution rather than a single lonely bar.
  const lo = indices.length ? indices.reduce((a, b) => (a < b ? a : b)) : 1n;
  const hi = indices.length ? indices.reduce((a, b) => (a > b ? a : b)) : 12n;
  const from = lo > 2n ? lo - 2n : 1n;
  const to = hi + 2n;

  const bands: { index: bigint; count: bigint }[] = [];
  for (let i = from; i <= to; i += 1n) bands.push({ index: i, count: present.get(i) ?? 0n });

  const max = bands.reduce((m, b) => (b.count > m ? b.count : m), 1n);

  return (
    <div>
      {/* items-stretch, not items-end: each column must be full height for the
          bar's percentage height to resolve against something. */}
      <div className="flex items-stretch gap-[3px] h-56" role="img"
           aria-label={`Compensation distribution across ${bands.length} bands, ${state.contributionCount} contributions total`}>
        {bands.map((b, i) => {
          const pct = Number(b.count) / Number(max);
          const isHit = highlight !== null && b.index === highlight;
          const empty = b.count === 0n;
          return (
            <div key={String(b.index)} className="flex-1 flex flex-col justify-end items-center group">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: `${Math.max(pct * 100, empty ? 1.5 : 8)}%`, opacity: empty ? 0.18 : 1 }}
                transition={{ duration: 0.7, delay: i * 0.035, ease: [0.22, 1, 0.36, 1] }}
                className={[
                  'w-full rounded-[2px]',
                  empty ? 'bg-bone/25' : isHit ? 'bg-volt' : 'bg-volt/55',
                  isHit ? 'shadow-[0_0_24px_rgba(199,255,61,0.45)]' : '',
                  'group-hover:bg-volt transition-colors',
                ].join(' ')}
              />
              <span className="mt-2 text-[10px] font-mono text-muted/70 tabular-nums">
                {short(b.index * width)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rule pt-4 flex flex-wrap gap-x-10 gap-y-2">
        <Stat label="Contributions" value={String(state.contributionCount)} />
        <Stat label="Unique participants" value={String(state.nullifierCount)} />
        <Stat label="Bands populated" value={String(state.buckets.length)} />
        <Stat label="Band width" value={usd(width)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
