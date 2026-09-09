import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Code, Plug, Terminal, Unplug } from 'lucide-react';

import { useInformer } from './useInformer';
import Distribution from './components/Distribution';
import Contribute from './components/Contribute';
import { CONTRACT_ADDRESS, INFORMER_PARAMS, PROVENANCE } from '../config.js';

const REPO = 'https://github.com/JayCul/informer';

export default function App() {
  const m = useInformer();
  const [showTech, setShowTech] = useState(false);

  const floorMet =
    m.state !== null && m.state.contributionCount >= m.state.kAnonymityFloor;

  return (
    <div className="min-h-screen grid-field">
      <Nav connected={m.connected} onConnect={m.connect} onDisconnect={m.disconnect} />

      <main className="mx-auto max-w-canvas px-6 md:px-12 lg:px-20">
        {/* Hero ------------------------------------------------------------ */}
        <section className="pt-20 md:pt-28 pb-16 grid lg:grid-cols-[1.05fr_1fr] gap-16 items-center">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-[clamp(2.6rem,6.2vw,5.2rem)] leading-[0.95] tracking-tightest font-extrabold"
            >
              KNOW YOUR<br />MARKET VALUE.<br />
              <span className="text-muted">KEEP YOUR<br />SALARY PRIVATE.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.12 }}
              className="mt-8 text-lg text-muted max-w-md leading-relaxed"
            >
              Informer is an anonymous compensation survey. Contribute what you earn,
              and the network verifies the contribution without ever receiving the figure.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm"
            >
              <Claim ok>Verifiable participation</Claim>
              <Claim ok>Private responses</Claim>
              <Claim>No figure on chain</Claim>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="rounded-2xl border border-line bg-surface/70 backdrop-blur p-7"
          >
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="text-[10px] uppercase tracking-[0.14em] text-muted">
                Live distribution · Preprod
              </h2>
              <span className="text-[10px] font-mono text-muted/70">
                {INFORMER_PARAMS.informerLabel}
              </span>
            </div>
            <Distribution state={m.state} highlight={m.receipt?.bucket ?? null} />
            {m.state && !floorMet && (
              <p className="mt-5 text-xs text-muted leading-relaxed">
                {String(m.state.contributionCount)} of {String(m.state.kAnonymityFloor)} contributions.
                Below the k-anonymity floor this distribution is not yet large enough to hide an
                individual inside it, and the survey says so rather than pretending otherwise.
              </p>
            )}
          </motion.div>
        </section>

        {/* Proof server ----------------------------------------------------- */}
        {m.proofServerOk === false && (
          <section className="mb-12 rounded-xl border border-amber-400/30 bg-amber-400/[0.05] p-6">
            <h2 className="font-semibold text-amber-300/90">Local proof server not detected</h2>
            <p className="mt-2 text-sm text-bone/80 max-w-3xl leading-relaxed">
              Proofs are generated on your machine, never on a server, so contributing needs a
              proof server running locally. Everything above is readable without it. On this
              hosted page Chrome must also be allowed to reach it, via the prompt asking whether
              this site may access other apps and services on this device.
            </p>
            <code className="mt-4 block overflow-x-auto rounded-lg border border-line bg-ink px-4 py-3 text-xs font-mono">
              {m.proofServerCommand}
            </code>
            <button onClick={() => m.refreshProofServer()}
                    className="mt-4 rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-bone transition">
              Check again
            </button>
          </section>
        )}

        {/* Contribute ------------------------------------------------------- */}
        <section className="py-14 border-t border-line">
          <SectionHead
            eyebrow="Contribute"
            title="Add one private data point"
            body="The survey is only worth reading because the responses are real. It is only answerable because they stay private."
          />
          <div className="mt-10">
            {!m.connected ? (
              <button onClick={() => m.connect().catch(() => {})}
                      className="inline-flex items-center gap-2 rounded-lg bg-volt px-6 py-3.5 font-semibold text-ink hover:brightness-110 transition">
                <Plug size={16} aria-hidden /> Connect wallet to contribute
              </button>
            ) : (
              <Contribute
                connected={m.connected} proofServerOk={m.proofServerOk} phase={m.phase}
                receipt={m.receipt} rejection={m.rejection}
                onSubmit={m.submit} onForget={m.forgetSecret}
              />
            )}
          </div>
        </section>

        {/* Privacy model ---------------------------------------------------- */}
        <section className="py-14 border-t border-line">
          <SectionHead
            eyebrow="Privacy model"
            title="What an observer can and cannot learn"
            body="Assume the strongest realistic adversary: someone reading every block, running their own indexer, holding the contract source."
          />
          <div className="mt-10 grid md:grid-cols-2 gap-px bg-line rounded-xl overflow-hidden border border-line">
            <Column title="Can learn" tone="muted" items={[
              'That a contribution occurred, and when',
              'Which band it fell in',
              'The running distribution and totals',
              'That each came from a distinct unspent nullifier',
              'The wallet that submitted, and its fees',
            ]} />
            <Column title="Cannot learn" tone="volt" items={[
              'Anyone’s compensation figure',
              'Who any contribution belongs to',
              'Whether two periods are the same person',
              'The contributor secret',
              'Whether a given person contributed at all',
            ]} />
          </div>
          <p className="mt-6 text-sm text-muted max-w-3xl leading-relaxed">
            The figure is absent rather than hidden: there is no ledger field that could hold
            one. The honest edges, including that a submitting wallet is visible and that small
            distributions leak, are documented in the README rather than left to be discovered.
          </p>
        </section>

        {/* Technical detail -------------------------------------------------- */}
        <section className="py-14 border-t border-line">
          <button onClick={() => setShowTech((v) => !v)}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted hover:text-bone transition"
                  aria-expanded={showTech}>
            <Terminal size={13} aria-hidden /> Technical detail
            <ChevronDown size={14} className={`transition-transform ${showTech ? 'rotate-180' : ''}`} aria-hidden />
          </button>

          {showTech && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        className="mt-8 grid lg:grid-cols-2 gap-8 overflow-hidden">
              <div className="rounded-xl border border-line bg-surface p-6">
                <h3 className="text-[10px] uppercase tracking-[0.14em] text-muted mb-4">Survey parameters</h3>
                <dl className="font-mono text-xs space-y-1.5 text-muted">
                  <KV k="contract" v={CONTRACT_ADDRESS} />
                  <KV k="band" v={`${INFORMER_PARAMS.minContribution} – ${INFORMER_PARAMS.maxContribution}`} />
                  <KV k="bucket width" v={String(INFORMER_PARAMS.bucketWidth)} />
                  <KV k="k-anon floor" v={String(INFORMER_PARAMS.kAnonymityFloor)} />
                  <KV k="period" v={INFORMER_PARAMS.periodLabel} />
                  <KV k="policyHash" v={PROVENANCE.policyHash} />
                  <KV k="circuitCommit" v={PROVENANCE.circuitCommitment} />
                </dl>
              </div>

              <div className="rounded-xl border border-line bg-surface p-6">
                <h3 className="text-[10px] uppercase tracking-[0.14em] text-muted mb-4">Provider trace</h3>
                <div className="max-h-64 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5">
                  {m.logs.length === 0 && <p className="text-muted/60">Nothing yet.</p>}
                  {m.logs.map((l) => (
                    <p key={l.id} className={
                      l.kind === 'ok' ? 'text-volt/80' : l.kind === 'err' ? 'text-red-400/80' : 'text-muted'
                    }>{l.text}</p>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </section>
      </main>

      <footer className="mt-8 border-t border-line">
        <div className="mx-auto max-w-canvas px-6 md:px-12 lg:px-20 py-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-semibold tracking-tight">INFORMER</div>
            <p className="text-sm text-muted mt-1">Anonymous compensation survey.</p>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted">
            <a href={REPO} className="inline-flex items-center gap-2 hover:text-bone transition">
              <Code size={15} aria-hidden /> Source
            </a>
            <span className="font-mono text-xs">Built on Midnight · Preprod</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Nav({ connected, onConnect, onDisconnect }: {
  connected: boolean; onConnect: () => Promise<void>; onDisconnect: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-ink/70 border-b border-line">
      <div className="mx-auto max-w-canvas px-6 md:px-12 lg:px-20 h-16 flex items-center justify-between">
        <span className="font-bold tracking-tight">INFORMER</span>
        {connected ? (
          <button onClick={onDisconnect}
                  className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-bone transition">
            <Unplug size={14} aria-hidden /> Disconnect
          </button>
        ) : (
          <button onClick={() => onConnect().catch(() => {})}
                  className="inline-flex items-center gap-2 rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-ink hover:brightness-110 transition">
            <Plug size={14} aria-hidden /> Connect wallet
          </button>
        )}
      </div>
    </header>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <div className="text-[10px] uppercase tracking-[0.14em] text-volt">{eyebrow}</div>
      <h2 className="mt-3 text-[clamp(1.8rem,3.4vw,2.9rem)] leading-[1.05] tracking-tightest font-bold">{title}</h2>
      <p className="mt-4 text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function Column({ title, tone, items }: { title: string; tone: 'muted' | 'volt'; items: string[] }) {
  return (
    <div className="bg-surface p-7">
      <h3 className={`text-[10px] uppercase tracking-[0.14em] mb-5 ${tone === 'volt' ? 'text-volt' : 'text-muted'}`}>
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((t) => (
          <li key={t} className="flex gap-3 text-sm text-bone/85">
            <span className={`mt-[7px] h-px w-4 shrink-0 ${tone === 'volt' ? 'bg-volt' : 'bg-muted'}`} />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Claim({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-volt' : 'bg-muted'}`} />
      {children}
    </span>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-muted/70">{k}</dt>
      <dd className="break-all text-bone/70">{v}</dd>
    </div>
  );
}
