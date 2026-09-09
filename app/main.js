import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import {
  PREPROD,
  INFORMER_PARAMS,
  PROVENANCE,
  CONTRACT_ADDRESS,
} from '../src/config.js';
import { connectLace } from './lace.js';
import { browserPasswordProvider } from './privateStorage.js';
import {
  traceObject,
  installGlobalErrorLogging,
  installFetchLogging,
} from './instrument.js';
import { contribute, readPublicState, PRIVATE_STATE_ID } from './contribute.js';
import { checkProofServer, PROOF_SERVER_COMMAND } from './proofServer.js';

// Must run before any wallet or contract operation. midnight-js keeps this as
// module-level state and throws on first use if it was never set.
setNetworkId(PREPROD.networkId);

const $ = (id) => document.getElementById(id);
const log = (msg, kind = 'info') => {
  const line = document.createElement('div');
  line.className = `line ${kind}`;
  line.textContent = msg;
  $('log').prepend(line);
};

installGlobalErrorLogging(log);
installFetchLogging(log);

let session = null;
let providers = null;

const usd = (n) => `$${Number(n).toLocaleString('en-US')}`;

/**
 * Reading the public ledger needs no wallet and no private state, so the
 * distribution is visible before anyone connects. Deliberately does not build
 * a private state provider: that store is scoped to an account, and there is
 * no account yet.
 */
const publicOnlyProviders = () => ({
  publicDataProvider: indexerPublicDataProvider(PREPROD.indexer, PREPROD.indexerWs),
});

function buildProviders() {
  const zkConfigProvider = traceObject(
    'zkConfigProvider',
    new FetchZkConfigProvider(
      `${window.location.origin}/zk/informer`,
      fetch.bind(window),
    ),
    ['getProverKey', 'getVerifierKey', 'getZKIR', 'get'],
    log,
  );

  return {
    ...publicOnlyProviders(),
    // Private state is scoped to the connected wallet, so one browser holding
    // two accounts cannot read across them.
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'informer-private-state',
      // browserPasswordProvider is a factory; the provider is what it returns.
      privateStoragePasswordProvider: browserPasswordProvider(),
      accountId: session.addresses.shielded,
    }),
    zkConfigProvider,
    proofProvider: traceObject(
      'proofProvider',
      httpClientProofProvider(PREPROD.proofServer, zkConfigProvider),
      ['proveTx'],
      log,
    ),
    walletProvider: traceObject(
      'walletProvider',
      session.walletProvider,
      ['balanceTx', 'getCoinPublicKey', 'getEncryptionPublicKey'],
      log,
    ),
    midnightProvider: traceObject(
      'midnightProvider',
      session.midnightProvider,
      ['submitTx'],
      log,
    ),
  };
}

// --------------------------------------------------------- proof server ---

let proofServerReady = false;

async function refreshProofServer({ quiet = false } = {}) {
  const banner = $('proof-banner');
  const result = await checkProofServer();
  proofServerReady = result.ok;

  if (result.ok) {
    banner.classList.add('ready');
    $('proof-banner-title').textContent = 'Local proof server detected';
    $('proof-banner-body').textContent =
      `Proving will run on ${result.url}. Contributions are ready to submit.`;
    $('proof-banner-cmd').hidden = true;
    if (!quiet) log(`Proof server reachable at ${result.url}.`, 'ok');
  } else {
    banner.classList.remove('ready');
    $('proof-banner-title').textContent = 'Local proof server not detected';
    const hosted = window.location.protocol === 'https:';
    $('proof-banner-body').textContent =
      `Reading the public distribution below needs nothing. Contributing needs a `
      + `proof server running on your own machine, because proofs are generated `
      + `locally and never on a server. ${result.url}: ${result.detail}. `
      + (hosted
        ? `Two things cause this. Either the proof server is not running, or the `
          + `browser has not been allowed to reach it: Chrome asks whether this `
          + `site may "access other apps and services on this device", and that `
          + `has to be allowed. Start the server with the command below, allow `
          + `the prompt, then check again.`
        : `Start it with the command below, then check again.`);
    $('proof-banner-cmd').hidden = false;
    $('proof-banner-cmd').textContent = PROOF_SERVER_COMMAND;
    if (!quiet) log(`Proof server unreachable (${result.detail}).`, 'err');
  }
  banner.hidden = false;
  updateContributeEnabled();
  return result.ok;
}

function updateContributeEnabled() {
  $('contribute').disabled = !(session && proofServerReady);
}

$('proof-recheck').addEventListener('click', () => {
  refreshProofServer().catch((err) => log(err.message, 'err'));
});

// ---------------------------------------------------------------- connect ---

$('connect').addEventListener('click', async () => {
  $('connect').disabled = true;
  try {
    log('Requesting connection. Approve it in the wallet extension.');
    session = await connectLace();
    providers = buildProviders();

    $('addr-shielded').textContent = session.addresses.shielded;
    const dust = await session.api.getDustBalance();
    $('dust-balance').textContent = `${dust.balance} (cap ${dust.cap})`;

    $('wallet-info').hidden = false;
    $('disconnect').hidden = false;
    updateContributeEnabled();
    log(`Connected via ${session.connectorName}.`, 'ok');
  } catch (err) {
    log(err.message, 'err');
    $('connect').disabled = false;
  }
});

// ------------------------------------------------------------- disconnect ---

$('disconnect').addEventListener('click', () => {
  // The connector exposes no revoke call, so disconnecting is the app dropping
  // every wallet-derived capability it holds. Nothing wallet-scoped survives.
  session = null;
  providers = null;

  $('addr-shielded').textContent = '';
  $('dust-balance').textContent = '';
  $('wallet-info').hidden = true;
  $('disconnect').hidden = true;
  $('privacy-proof').hidden = true;
  $('connect').disabled = false;
  updateContributeEnabled();
  log('Disconnected. Wallet handles and providers dropped.', 'ok');
});

// ------------------------------------------------------------- contribute ---

$('contribute').addEventListener('click', async () => {
  const raw = BigInt($('salary').value || '0');
  const { minContribution, maxContribution } = INFORMER_PARAMS;

  if (raw < minContribution || raw > maxContribution) {
    log(
      `Figure must be between ${usd(minContribution)} and ${usd(maxContribution)}.`,
      'err',
    );
    return;
  }

  $('contribute').disabled = true;
  try {
    // Re-check rather than trust a stale result: Docker may have stopped since
    // the page loaded, and failing here is far clearer than failing mid-proof.
    if (!(await refreshProofServer({ quiet: true }))) {
      log('Cannot contribute: the local proof server is not running.', 'err');
      return;
    }
    const result = await contribute({ providers, raw, log });

    $('pp-raw').textContent = `${usd(raw)} — never transmitted`;
    const low = result.bucket * INFORMER_PARAMS.bucketWidth;
    $('pp-bucket').textContent =
      `${result.bucket} (${usd(low)} to ${usd(low + INFORMER_PARAMS.bucketWidth)})`;
    $('pp-tx').textContent = result.txHash ?? result.txId ?? 'submitted';
    $('privacy-proof').hidden = false;

    log('Contribution accepted.', 'ok');
    await refreshState();
  } catch (err) {
    console.error(err);
    const already = /already contributed/i.test(err.message ?? '');
    log(`${err.name}: ${err.message}`, 'err');

    // midnight-js wraps the real failure as a cause. Its stack is the only
    // thing that names which call actually threw, so surface it.
    let cause = err.cause;
    let depth = 0;
    while (cause && depth < 3) {
      log(`cause[${depth}]: ${cause.name ?? 'Error'}: ${cause.message ?? String(cause)}`, 'err');
      const frames = String(cause.stack ?? '')
        .split(String.fromCharCode(10))
        .filter((l) => l.includes('at '))
        .slice(0, 4);
      for (const f of frames) log(`  ${f.trim()}`, 'err');
      cause = cause.cause;
      depth += 1;
    }
    if (already) {
      log(
        'Rejected by the nullifier. The contract knows this participant already '
          + 'contributed, without knowing who they are.',
        'ok',
      );
    }
  } finally {
    updateContributeEnabled();
  }
});

// ----------------------------------------------------------- public state ---

async function refreshState() {
  const p = providers ?? publicOnlyProviders();
  log('Reading public contract state.');
  const state = await readPublicState(p);
  if (!state) {
    log('No contract state found at the configured address.', 'err');
    return;
  }

  $('state-summary').textContent =
    `${state.contributionCount} contributions, ${state.nullifierCount} unique participants`;

  const max = state.buckets.reduce((m, b) => (b.count > m ? b.count : m), 1n);
  $('histogram').innerHTML = '';
  for (const b of state.buckets) {
    const low = b.index * state.bucketWidth;
    const row = document.createElement('div');
    row.className = 'bar';
    row.innerHTML =
      `<span class="label">${usd(low)}</span>` +
      `<span class="fill" style="width:${(Number(b.count) / Number(max)) * 100}%"></span>` +
      `<span class="n">${b.count}</span>`;
    $('histogram').append(row);
  }

  const floor = state.kAnonymityFloor;
  const note = $('floor-note');
  if (state.contributionCount < floor) {
    note.textContent =
      `${state.contributionCount} of ${floor} contributions. This distribution is `
      + `below the k-anonymity floor, so it is not yet large enough to hide an `
      + `individual inside it.`;
    note.hidden = false;
  } else {
    note.hidden = true;
  }
  log('Public state read.', 'ok');
}

$('refresh').addEventListener('click', () => {
  refreshState().catch((err) => log(err.message, 'err'));
});

// ------------------------------------------------------------------ setup ---

$('contract-address').textContent = CONTRACT_ADDRESS;
$('params').textContent = [
  `bucket width      ${INFORMER_PARAMS.bucketWidth}`,
  `band              ${INFORMER_PARAMS.minContribution} to ${INFORMER_PARAMS.maxContribution}`,
  `k-anonymity floor ${INFORMER_PARAMS.kAnonymityFloor}`,
  `informer id       ${INFORMER_PARAMS.informerLabel}`,
  `period            ${INFORMER_PARAMS.periodLabel}`,
  `policy hash       ${PROVENANCE.policyHash.slice(0, 24)}...`,
  `circuit commit    ${PROVENANCE.circuitCommitment.slice(0, 24)}...`,
  `private state     ${PRIVATE_STATE_ID}`,
].join('\n');

refreshProofServer({ quiet: true }).catch(() => {});

// Public state needs no wallet, so show it immediately.
refreshState().catch((err) => log(`Initial state read failed: ${err.message}`, 'err'));
