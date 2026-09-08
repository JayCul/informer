// Preflight: verifies everything the deploy needs, before the deploy needs it.
// Runs without a wallet seed, so it can be checked independently.
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { PREPROD } from '../src/config.js';

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark.padEnd(5)} ${name.padEnd(34)} ${detail}`);
};

// --- 1. Compiled artifacts -------------------------------------------------
const required = [
  'managed/informer/contract/index.js',
  'managed/informer/keys/contribute.prover',
  'managed/informer/keys/contribute.verifier',
  'managed/informer/zkir/contribute.bzkir',
];
for (const path of required) {
  record(`artifact ${path.split('/').pop()}`, existsSync(path), path);
}

// --- 2. Toolchain pinning --------------------------------------------------
try {
  const info = JSON.parse(
    readFileSync('managed/informer/compiler/contract-info.json', 'utf8'),
  );
  const expected = {
    'compiler-version': '0.31.1',
    'language-version': '0.23.0',
    'runtime-version': '0.16.0',
  };
  for (const [key, want] of Object.entries(expected)) {
    record(`pinned ${key}`, info[key] === want, `${info[key]} (want ${want})`);
  }
  record(
    'circuit contribute present',
    info.circuits.some((c) => c.name === 'contribute'),
    info.circuits.map((c) => c.name).join(', '),
  );
} catch (err) {
  record('contract-info.json', false, err.message);
}

// --- 2b. Provenance commitments -------------------------------------------
try {
  const { createHash } = await import('node:crypto');
  const sha256 = (path) =>
    createHash('sha256').update(readFileSync(path)).digest('hex');
  const { PROVENANCE: prov } = await import('../src/provenance.js');

  record(
    'policyHash matches POLICY.md',
    prov.policyHash === sha256('POLICY.md'),
    `${prov.policyHash.slice(0, 16)}...`,
  );
  record(
    'circuitCommitment matches key',
    prov.circuitCommitment === sha256('managed/informer/keys/contribute.verifier'),
    `${prov.circuitCommitment.slice(0, 16)}...`,
  );
} catch (err) {
  record('provenance', false, `${err.message} (run: npm run provenance)`);
}

// --- 3. Proof server -------------------------------------------------------
const proofServer = process.env.PROOF_SERVER ?? PREPROD.proofServer;
try {
  const res = await fetch(`${proofServer}/health`, {
    signal: AbortSignal.timeout(5000),
  });
  record('proof server', res.ok, `${proofServer} -> ${res.status}`);
} catch (err) {
  record('proof server', false, `${proofServer} unreachable (${err.message})`);
}

// --- 4. Indexer ------------------------------------------------------------
try {
  const res = await fetch(PREPROD.indexer, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: '{ __typename }' }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json();
  record('indexer', res.ok && !body.errors, `${PREPROD.indexer} -> ${res.status}`);
} catch (err) {
  record('indexer', false, `unreachable (${err.message})`);
}

// --- 5. Node RPC -----------------------------------------------------------
try {
  const res = await fetch(PREPROD.node, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'system_chain',
      params: [],
    }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json();
  record('node rpc', res.ok && !!body.result, `${body.result ?? res.status}`);
} catch (err) {
  record('node rpc', false, `unreachable (${err.message})`);
}

// --- 6. Wallet configuration ----------------------------------------------
record(
  'shielded address configured',
  Boolean(process.env.MIDNIGHT_SHIELDED_ADDRESS),
  process.env.MIDNIGHT_SHIELDED_ADDRESS
    ? `${process.env.MIDNIGHT_SHIELDED_ADDRESS.slice(0, 28)}...`
    : 'missing (set in .env)',
);
// Deploying happens in the browser through the Lace connector, so no seed is
// needed and none should be stored. Reported for information only.
console.log(
  `INFO  ${'deploy path'.padEnd(34)} browser via Lace connector (no seed stored)`,
);

// --- Summary ---------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed`,
);
if (failed.length > 0) {
  console.log('blocking:', failed.map((f) => f.name).join(', '));
  process.exitCode = 1;
}
