import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Lock, ShieldAlert, Trash2 } from 'lucide-react';
import type { Phase, Receipt } from '../useInformer';
import { INFORMER_PARAMS } from '../../config.js';

const usd = (n: bigint) => `$${Number(n).toLocaleString('en-US')}`;

type Props = {
  connected: boolean;
  proofServerOk: boolean | null;
  phase: Phase;
  receipt: Receipt | null;
  rejection: string | null;
  onSubmit: (raw: bigint) => void;
  onForget: () => void;
};

export default function Contribute({
  connected, proofServerOk, phase, receipt, rejection, onSubmit, onForget,
}: Props) {
  const [value, setValue] = useState('72000');

  const min = INFORMER_PARAMS.minContribution as bigint;
  const max = INFORMER_PARAMS.maxContribution as bigint;
  const raw = (() => { try { return BigInt(value || '0'); } catch { return 0n; } })();
  const inBand = raw >= min && raw <= max;
  const busy = phase === 'working';
  const ready = connected && proofServerOk === true && inBand && !busy;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-2">
            Annual total compensation
          </span>
          <div className="flex items-center gap-2 border border-line rounded-lg bg-canvas px-4 py-3 focus-within:border-volt/60 transition-colors">
            <span className="text-muted font-mono text-sm">$</span>
            <input
              type="number" inputMode="numeric" value={value}
              onChange={(e) => setValue(e.target.value)}
              min={String(min)} max={String(max)} step={1000}
              aria-label="Annual total compensation in US dollars"
              className="bg-transparent w-40 text-lg font-semibold tabular-nums outline-none"
            />
            <Lock size={14} className="text-muted/70" aria-hidden />
          </div>
        </label>

        <button
          onClick={() => onSubmit(raw)} disabled={!ready}
          className="inline-flex items-center gap-2 rounded-lg bg-volt px-6 py-3.5 font-semibold text-volt-ink
                     disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 transition"
        >
          {busy ? 'Proving…' : 'Contribute privately'}
          {!busy && <ArrowRight size={16} aria-hidden />}
        </button>

        {connected && (
          <button
            onClick={onForget}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-3.5 text-sm text-muted
                       hover:text-ink hover:border-ink/20 transition"
            title="Deletes the contributor secret stored in this browser. Changes nothing on chain."
          >
            <Trash2 size={14} aria-hidden /> Reset local identity
          </button>
        )}
      </div>

      {!inBand && value !== '' && (
        <p className="mt-3 text-sm text-muted">
          The survey band runs {usd(min)} to {usd(max)}. Figures outside it are rejected by the circuit.
        </p>
      )}

      <p className="mt-4 text-sm text-muted max-w-xl leading-relaxed">
        Your figure is written to local private state and read by a witness inside the
        circuit. The transaction carries a proof, not the number.
      </p>

      <AnimatePresence mode="wait">
        {phase === 'accepted' && receipt && (
          <motion.div
            key="accepted"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 grid sm:grid-cols-2 gap-px bg-line rounded-xl overflow-hidden border border-line"
          >
            <Half tone="private" title="Stayed on this device">
              <Row k="Your figure" v={usd(receipt.raw)} redacted />
              <Row k="Your secret" v="32 bytes, never transmitted" />
            </Half>
            <Half tone="public" title="Reached the chain">
              <Row k="Band" v={`${usd(receipt.low)} – ${usd(receipt.high)}`} />
              <Row k="Nullifier" v="one-way hash of a secret it cannot see" />
              {receipt.tx && <Row k="Transaction" v={`${receipt.tx.slice(0, 18)}…`} mono />}
            </Half>
          </motion.div>
        )}

        {phase === 'rejected' && (
          <motion.div
            key="rejected"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="mt-8 rounded-xl border border-volt/40 bg-volt/10 p-6"
          >
            <div className="flex items-center gap-2 text-volt font-semibold">
              <ShieldAlert size={16} aria-hidden /> Contribution rejected
            </div>
            <p className="mt-2 text-sm text-ink/90 max-w-2xl leading-relaxed">{rejection}</p>
            <p className="mt-3 text-sm text-muted max-w-2xl leading-relaxed">
              This is the whole idea. One person, one contribution, enforced by a nullifier
              that is a one-way hash of a secret the contract never receives. It knows you
              are a repeat, and nothing else about you.
            </p>
          </motion.div>
        )}

        {phase === 'idle' && rejection && (
          <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="mt-6 text-sm text-red-400/90 font-mono">
            {rejection}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Half({ tone, title, children }: { tone: 'private' | 'public'; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface p-6">
      <div className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] mb-4 ${
        tone === 'private' ? 'text-muted' : 'text-volt'}`}>
        {tone === 'private' ? <Lock size={12} aria-hidden /> : <Check size={12} aria-hidden />}
        {title}
      </div>
      <dl className="space-y-3">{children}</dl>
    </div>
  );
}

function Row({ k, v, redacted, mono }: { k: string; v: string; redacted?: boolean; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{k}</dt>
      <dd className={`mt-0.5 ${mono ? 'font-mono text-xs' : 'text-sm'} ${redacted ? 'text-ink' : 'text-ink/85'}`}>
        {redacted ? <span className="line-through decoration-red-400/70 decoration-2">{v}</span> : v}
        {redacted && <span className="ml-2 text-[11px] text-muted">never sent</span>}
      </dd>
    </div>
  );
}
