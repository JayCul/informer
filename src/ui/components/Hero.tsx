import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, Lock, ShieldCheck } from 'lucide-react';
import type { PublicState } from '../useInformer';

const usd = (n: bigint) => `$${Number(n).toLocaleString('en-US')}`;

type Props = {
  state: PublicState | null;
  onPrimary: () => void;
  onSecondary: () => void;
};

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
});

/**
 * The floating cards are the four things the product actually does, so the
 * composition explains Informer rather than decorating around it.
 */
export default function Hero({ state, onPrimary, onSecondary }: Props) {
  const bars = state?.buckets.slice(0, 6) ?? [];
  const max = bars.reduce((m, b) => (b.count > m ? b.count : m), 1n);

  return (
    <section className="px-4 sm:px-6 lg:px-10 pt-6">
      <div className="relative dot-field rounded-[28px] border border-line bg-surface/60 overflow-hidden">
        {/* ---------------------------------------------- floating: private */}
        <motion.div
          {...rise(0.45)}
          className="float-card left-6 xl:left-14 top-16 w-[248px] p-5 -rotate-[7deg]"
          aria-hidden
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted">
            <Lock size={12} /> On your device
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight line-through decoration-red-500/60 decoration-2">
            $72,000
          </p>
          <p className="mt-1.5 text-xs text-muted leading-relaxed">
            Read by a witness inside the circuit. Never transmitted, never stored.
          </p>
        </motion.div>

        {/* ------------------------------------------- floating: distribution */}
        <motion.div
          {...rise(0.55)}
          className="float-card right-6 xl:right-14 top-14 w-[268px] p-5 rotate-[5deg]"
          aria-hidden
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted">
            <BarChart3 size={12} /> Public distribution
          </div>
          <div className="mt-4 flex items-end gap-1.5 h-16">
            {(bars.length ? bars : [{ index: 0n, count: 1n }]).map((b, i) => (
              <div key={i} className="flex-1 rounded-[2px] bg-volt"
                   style={{ height: `${Math.max((Number(b.count) / Number(max)) * 100, 22)}%` }} />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Bands and counts. No field could hold a figure.
          </p>
        </motion.div>

        {/* ------------------------------------------------ floating: totals */}
        <motion.div
          {...rise(0.65)}
          className="float-card left-8 xl:left-20 bottom-16 w-[232px] p-5 rotate-[4deg]"
          aria-hidden
        >
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted">This survey</div>
          <div className="mt-3 flex gap-6">
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {state ? String(state.contributionCount) : '—'}
              </div>
              <div className="text-[11px] text-muted">contributions</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {state ? String(state.nullifierCount) : '—'}
              </div>
              <div className="text-[11px] text-muted">participants</div>
            </div>
          </div>
          {state && (
            <div className="mt-3 text-[11px] text-muted">
              band width {usd(state.bucketWidth)}
            </div>
          )}
        </motion.div>

        {/* --------------------------------------------- floating: nullifier */}
        <motion.div
          {...rise(0.75)}
          className="float-card right-8 xl:right-20 bottom-14 w-[262px] p-5 -rotate-[5deg]"
          aria-hidden
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted">
            <ShieldCheck size={12} /> One per participant
          </div>
          <p className="mt-3 text-sm font-semibold text-volt">Already contributed</p>
          <p className="mt-1.5 text-xs text-muted leading-relaxed">
            Rejected by a nullifier, without the contract ever learning who you are.
          </p>
        </motion.div>

        {/* -------------------------------------------------------- centre */}
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 md:py-32 text-center">
          <motion.div {...rise(0)} className="inline-flex">
            <div className="h-14 w-14 rounded-2xl border border-line bg-raised grid place-items-center shadow-sm">
              <BarChart3 className="text-volt" size={24} aria-hidden />
            </div>
          </motion.div>

          <motion.h1
            {...rise(0.08)}
            className="mt-8 text-[clamp(2rem,4.6vw,3.5rem)] leading-[1.06] tracking-tightest font-bold text-balance"
          >
            Know your market value
            <br />
            <span className="text-muted">keep your salary private</span>
          </motion.h1>

          <motion.p {...rise(0.16)} className="mt-6 text-lg text-muted leading-relaxed max-w-xl mx-auto text-balance">
            An anonymous compensation survey. Contribute what you earn, and the network
            verifies it without ever receiving the figure.
          </motion.p>

          <motion.div {...rise(0.24)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onPrimary}
              className="inline-flex items-center gap-2 rounded-xl bg-volt px-7 py-3.5 font-semibold
                         text-volt-ink hover:brightness-110 active:brightness-95 transition shadow-sm"
            >
              Contribute privately <ArrowRight size={16} aria-hidden />
            </button>
            <button
              onClick={onSecondary}
              className="rounded-xl border border-line px-6 py-3.5 font-medium text-muted
                         hover:text-ink hover:border-ink/20 transition"
            >
              See what the chain holds
            </button>
          </motion.div>

          <motion.p {...rise(0.32)} className="mt-6 text-xs text-muted">
            Live on Midnight Preprod. No account, no email, no figure on chain.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
