import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Code, Plug, Terminal, Unplug } from 'lucide-react';

import { useInformer } from './useInformer';
import { useTheme } from './useTheme';
import ThemeToggle from './components/ThemeToggle';
import Hero from './components/Hero';
import Distribution from './components/Distribution';
import Contribute from './components/Contribute';
import { CONTRACT_ADDRESS, INFORMER_PARAMS, PROVENANCE } from '../config.js';

const REPO = 'https://github.com/JayCul/informer';

export default function App() {
  const m = useInformer();
  const { theme, toggle } = useTheme();
  const [showTech, setShowTech] = useState(false);

  const contributeRef = useRef<HTMLDivElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);
  const scrollTo = (r: React.RefObject<HTMLDivElement | null>) =>
    r.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const floorMet = m.state !== null && m.state.contributionCount >= m.state.kAnonymityFloor;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 backdrop-blur bg-canvas/80 border-b border-line">
        <div className="mx-auto max-w-canvas px-6 h-16 flex items-center justify-between">
          <span className="font-bold tracking-tight">Informer</span>
          <div className="flex items-center gap-2.5">
            <ThemeToggle theme={theme} onToggle={toggle} />
            {m.connected ? (
              <button onClick={m.disconnect}
                      className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink transition">
                <Unplug size={14} aria-hidden /> Disconnect
              </button>
            ) : (
              <button onClick={() => m.connect().catch(() => {})}
                      className="inline-flex items-center gap-2 rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-volt-ink hover:brightness-110 transition">
                <Plug size={14} aria-hidden /> Connect wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <Hero
        state={m.state}
        onPrimary={() => scrollTo(contributeRef)}
        onSecondary={() => scrollTo(chainRef)}
      />

      <main className="mx-auto max-w-canvas px-6">
        {m.proofServerOk === false && (
          <section className="mt-14 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-6">
            <h2 className="font-semibold">Local proof server not detected</h2>
            <p className="mt-2 text-sm text-ink/80 max-w-3xl leading-relaxed">
              Proofs are generated on your machine, never on a server, so contributing needs a
              proof server running locally. Everything else on this page works without it. On a
              hosted page Chrome must also be allowed to reach it, through the prompt asking
              whether this site may access other apps and services on this device.
            </p>
            <code className="mt-4 block overflow-x-auto rounded-lg border border-line bg-canvas px-4 py-3 text-xs font-mono">
              {m.proofServerCommand}
            </code>
            <button onClick={() => m.refreshProofServer()}
                    className="mt-4 rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink transition">
              Check again
            </button>
          </section>
        )}

        <div ref={contributeRef} className="scroll-mt-20" />
        <section className="py-20">
          <SectionHead
            eyebrow="Contribute"
            title="Add one private data point"
            body="The survey is only worth reading because the responses are real. It is only answerable because they stay private."
          />
          <div className="mt-10">
            {!m.connected ? (
              <button onClick={() => m.connect().catch(() => {})}
                      className="inline-flex items-center gap-2 rounded-xl bg-volt px-6 py-3.5 font-semibold text-volt-ink hover:brightness-110 transition">
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

        <div ref={chainRef} className="scroll-mt-20" />
        <section className="py-20 border-t border-line">
          <SectionHead
            eyebrow="Public state"
            title="What the chain actually holds"
            body="Read straight from ledger state. Bands and counts, and nothing that could identify a contributor."
          />
          <div className="mt-10 card p-7">
            <Distribution state={m.state} highlight={m.receipt?.bucket ?? null} />
            {m.state && !floorMet && (
              <p className="mt-6 text-sm text-muted leading-relaxed max-w-2xl">
                {String(m.state.contributionCount)} of {String(m.state.kAnonymityFloor)} contributions.
                Below the k-anonymity floor a distribution is not large enough to hide an individual
                inside it, and this survey says so rather than pretending otherwise.
              </p>
            )}
          </div>
        </section>

        <section className="py-20 border-t border-line">
          <SectionHead
            eyebrow="Privacy model"
            title="What an observer can and cannot learn"
            body="Assume the strongest realistic adversary: someone reading every block, running their own indexer, holding the contract source."
          />
          <div className="mt-10 grid md:grid-cols-2 gap-6">
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
            The figure is absent rather than hidden: there is no ledger field that could hold one.
            The honest edges, including that a submitting wallet is visible and that small
            distributions leak, are documented in the README rather than left to be discovered.
          </p>
        </section>

        <section className="py-16 border-t border-line">
          <button onClick={() => setShowTech((v) => !v)}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted hover:text-ink transition"
                  aria-expanded={showTech}>
            <Terminal size={13} aria-hidden /> Technical detail
            <ChevronDown size={14} className={`transition-transform ${showTech ? 'rotate-180' : ''}`} aria-hidden />
          </button>

          {showTech && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        className="mt-8 grid lg:grid-cols-2 gap-6 overflow-hidden">
              <div className="card p-6">
                <h3 className="text-[10px] uppercase tracking-[0.14em] text-muted mb-4">Survey parameters</h3>
                <dl className="font-mono text-xs space-y-1.5">
                  <KV k="contract" v={CONTRACT_ADDRESS} />
                  <KV k="band" v={`${INFORMER_PARAMS.minContribution} – ${INFORMER_PARAMS.maxContribution}`} />
                  <KV k="bucket width" v={String(INFORMER_PARAMS.bucketWidth)} />
                  <KV k="k-anon floor" v={String(INFORMER_PARAMS.kAnonymityFloor)} />
                  <KV k="period" v={INFORMER_PARAMS.periodLabel} />
                  <KV k="policyHash" v={PROVENANCE.policyHash} />
                  <KV k="circuitCommit" v={PROVENANCE.circuitCommitment} />
                </dl>
              </div>

              <div className="card p-6">
                <h3 className="text-[10px] uppercase tracking-[0.14em] text-muted mb-4">Provider trace</h3>
                <div className="max-h-64 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5">
                  {m.logs.length === 0 && <p className="text-muted">Nothing yet.</p>}
                  {m.logs.map((l) => (
                    <p key={l.id} className={
                      l.kind === 'ok' ? 'text-volt' : l.kind === 'err' ? 'text-red-500' : 'text-muted'
                    }>{l.text}</p>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-canvas px-6 py-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-semibold tracking-tight">Informer</div>
            <p className="text-sm text-muted mt-1">Anonymous compensation survey.</p>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted">
            <a href={REPO} className="inline-flex items-center gap-2 hover:text-ink transition">
              <Code size={15} aria-hidden /> Source
            </a>
            <span className="font-mono text-xs">Built on Midnight · Preprod</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <div className="text-[10px] uppercase tracking-[0.14em] text-volt font-semibold">{eyebrow}</div>
      <h2 className="mt-3 text-[clamp(1.7rem,3.2vw,2.6rem)] leading-[1.08] tracking-tightest font-bold">{title}</h2>
      <p className="mt-4 text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function Column({ title, tone, items }: { title: string; tone: 'muted' | 'volt'; items: string[] }) {
  return (
    <div className="card p-7">
      <h3 className={`text-[10px] uppercase tracking-[0.14em] mb-5 font-semibold ${tone === 'volt' ? 'text-volt' : 'text-muted'}`}>
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((t) => (
          <li key={t} className="flex gap-3 text-sm text-ink/85">
            <span className={`mt-[7px] h-px w-4 shrink-0 ${tone === 'volt' ? 'bg-volt' : 'bg-muted'}`} />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-muted">{k}</dt>
      <dd className="break-all text-ink/75">{v}</dd>
    </div>
  );
}
