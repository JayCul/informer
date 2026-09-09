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
    $('contribute').disabled = false;
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
  $('contribute').disabled = true;
  $('connect').disabled = false;
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
    if (already) {
      log(
        'Rejected by the nullifier. The contract knows this participant already '
          + 'contributed, without knowing who they are.',
        'ok',
      );
    }
  } finally {
    $('contribute').disabled = session === null;
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

// Public state needs no wallet, so show it immediately.
refreshState().catch((err) => log(`Initial state read failed: ${err.message}`, 'err'));
