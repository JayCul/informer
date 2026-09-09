import { motion } from 'framer-motion';
import { Check, Fingerprint, Lock, X } from 'lucide-react';
import Reveal from './Reveal';

/**
 * The three-stage flow, ending on the nullifier.
 *
 * Stage three is the signature moment: a second attempt is refused, and the
 * refusal is possible precisely because the contract holds a one-way hash
 * rather than an identity.
 */
export default function HowItWorks() {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Reveal delay={0}>
        <Stage
          n="01"
          icon={<Lock size={16} aria-hidden />}
          title="Enter"
          body="Your figure is written to local private state and read by a witness inside the circuit. It is an input to a proof, never a field in a transaction."
        >
          <div className="font-mono text-xs space-y-1">
            <Line label="rawContribution()" value="witness" />
            <Line label="contributorSecret()" value="witness" />
            <Line label="on chain" value="nothing yet" dim />
          </div>
        </Stage>
      </Reveal>

      <Reveal delay={0.08}>
        <Stage
          n="02"
          icon={<Check size={16} aria-hidden />}
          title="Prove"
          body="The circuit pins the band by multiplication, so exactly one index satisfies it. A band cannot be faked, and the figure behind it never leaves."
        >
          <div className="font-mono text-xs space-y-1">
            <Line label="bucket × width" value="≤ raw" />
            <Line label="raw" value="< (bucket+1) × width" />
            <Line label="discloses" value="band index" accent />
          </div>
        </Stage>
      </Reveal>

      <Reveal delay={0.16}>
        <Stage
          n="03"
          icon={<Fingerprint size={16} aria-hidden />}
          title="Spend once"
          body="A nullifier derived from your secret, this survey and this period is recorded. Contribute again and it is refused, without anyone learning who you are."
        >
          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.4 }}
              className="flex items-center gap-2 text-xs font-mono"
            >
              <Check size={13} className="text-volt shrink-0" aria-hidden />
              <span className="text-muted">first contribution</span>
              <span className="ml-auto text-volt">accepted</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.45, duration: 0.4 }}
              className="flex items-center gap-2 text-xs font-mono"
            >
              <X size={13} className="text-red-500 shrink-0" aria-hidden />
              <span className="text-muted">same participant</span>
              <span className="ml-auto text-red-500">rejected</span>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true }} transition={{ delay: 0.7, duration: 0.5 }}
              className="pt-1 text-[11px] text-muted leading-relaxed"
            >
              Identity never entered the exchange, so there was none to reveal.
            </motion.p>
          </div>
        </Stage>
      </Reveal>
    </div>
  );
}

function Stage({
  n, icon, title, body, children,
}: {
  n: string; icon: React.ReactNode; title: string; body: string; children: React.ReactNode;
}) {
  return (
    <div className="card p-7 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted">{n}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-line text-volt">
          {icon}
        </span>
      </div>
      <h3 className="mt-5 text-xl font-bold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm text-muted leading-relaxed flex-1">{body}</p>
      <div className="mt-6 pt-5 border-t border-line">{children}</div>
    </div>
  );
}

function Line({ label, value, dim, accent }: { label: string; value: string; dim?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={accent ? 'text-volt' : dim ? 'text-muted/60' : 'text-ink/75'}>{value}</span>
    </div>
  );
}
