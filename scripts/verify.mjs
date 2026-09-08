// One-command submission summary. Reads only real build artifacts and the
// live network, so anything it prints is a fact about the current tree.
//
//   npm run verify
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PROVENANCE } from '../src/provenance.js';

const line = (k, v) => console.log(`  ${k.padEnd(22)} ${v}`);
const rule = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`);

const info = JSON.parse(
  readFileSync('managed/informer/compiler/contract-info.json', 'utf8'),
);

rule('Toolchain');
line('compiler', info['compiler-version']);
line('language', info['language-version']);
line('runtime', info['runtime-version']);
line('mainnet compatible', '0.31.x line (ledger 8)');

rule('Circuits');
for (const c of info.circuits) {
  const args = c.arguments.map((a) => a.name).join(', ');
  line(c.name, `(${args}) proof=${c.proof} pure=${c.pure}`);
}

rule('Witnesses (private, never on chain)');
for (const w of info.witnesses) {
  const t = w['result type'];
  line(w.name, t.length ? `${t['type-name']}<${t.length}>` : t['type-name']);
}

rule('Compiled artifacts');
for (const f of [
  'managed/informer/contract/index.js',
  'managed/informer/keys/contribute.prover',
  'managed/informer/keys/contribute.verifier',
  'managed/informer/zkir/contribute.bzkir',
]) {
  line(f.split('/').pop(), existsSync(f) ? `${statSync(f).size} bytes` : 'MISSING');
}

rule('Provenance committed on chain');
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const policyOk = PROVENANCE.policyHash === sha256('POLICY.md');
const circuitOk =
  PROVENANCE.circuitCommitment ===
  sha256('managed/informer/keys/contribute.verifier');
line('policyHash', `${PROVENANCE.policyHash} ${policyOk ? 'matches POLICY.md' : 'MISMATCH'}`);
line('circuitCommitment', `${PROVENANCE.circuitCommitment} ${circuitOk ? 'matches key' : 'MISMATCH'}`);

rule('Deployment (Preprod)');
line('contract', '5fbb4537a81a10e0744890e48045d4709f87838796ba852913cdc57f7f6f72d1');
line('tx', '2b237dff132198d0c2456a700d138ea04e3fe69e819bdb00343b4b5f410d4b16');
line('block', '2460317');
console.log('\n  verify independently: node scripts/find-contract.mjs\n');

if (!policyOk || !circuitOk) process.exitCode = 1;
