import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

import { Contract } from '../managed/informer/contract/index.js';
import { PREPROD, INFORMER_PARAMS, PROVENANCE, label32, hex32 } from '../src/config.js';
import { connectLace } from './lace.js';
import {
  browserPasswordProvider,
  passwordIsPersistent,
} from './privateStorage.js';
import {
  traceObject,
  installGlobalErrorLogging,
  installFetchLogging,
} from './instrument.js';

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

// The deployer runs no circuits, so these are never invoked during deploy.
const witnesses = {
  contributorSecret: ({ privateState }) => [privateState, new Uint8Array(32)],
  rawContribution: ({ privateState }) => [privateState, 0n],
  contributionBucket: ({ privateState }) => [privateState, 0n],
};

installGlobalErrorLogging(log);
installFetchLogging(log);

let session = null;

$('connect').addEventListener('click', async () => {
  $('connect').disabled = true;
  try {
    log('Requesting connection. Approve it in the wallet extension.');
    session = await connectLace();

    $('addr-shielded').textContent = session.addresses.shielded;
    $('addr-unshielded').textContent = session.addresses.unshielded;
    $('addr-dust').textContent = session.addresses.dust;
    $('wallet-info').hidden = false;

    const dust = await session.api.getDustBalance();
    $('dust-balance').textContent = `${dust.balance} (cap ${dust.cap})`;

    log(`Connected via ${session.connectorName}.`, 'ok');
    $('deploy').disabled = false;
  } catch (err) {
    log(err.message, 'err');
    $('connect').disabled = false;
  }
});

$('deploy').addEventListener('click', async () => {
  $('deploy').disabled = true;
  try {
    log('Building providers.');
    const zkConfigProvider = traceObject(
      'zkConfigProvider',
      new FetchZkConfigProvider(
        `${window.location.origin}/zk/informer`,
        fetch.bind(window),
      ),
      ['getProverKey', 'getVerifierKey', 'getZKIR', 'get'],
      log,
    );
    if (!passwordIsPersistent()) {
      log(
        'Storage is blocked, so private state will not survive a reload.',
        'err',
      );
    }
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: 'informer-private-state',
        // The store is encrypted at rest, so a password provider is required.
        privateStoragePasswordProvider: browserPasswordProvider(),
        // Namespaces private state per wallet, so switching wallets does not
        // read another wallet's state.
        accountId: session.addresses.shielded,
      }),
      publicDataProvider: indexerPublicDataProvider(
        PREPROD.indexer,
        PREPROD.indexerWs,
      ),
      // Serves the compiled circuits and keys from public/zk/informer.
      // Deliberately not /managed: that URL would collide with the real
      // managed/ sources Vite transforms, and public/ files are served raw.
      zkConfigProvider: zkConfigProvider,
      // httpClientProofProvider takes (url, zkConfigProvider, config). Passing
      // only the url left it without key material, because the internal
      // getKeyMaterial swallows the resulting error and returns undefined.
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

    // midnight-js 4.1.1 takes a CompiledContract wrapper, not a bare
    // `new Contract(...)`. The wrapper carries the witnesses on an internal
    // symbol that the runtime reads.
    const compiledContract = CompiledContract.make('informer', Contract).pipe(
      CompiledContract.withWitnesses(witnesses),
    );

    log('Deploying. The wallet will ask you to approve the transaction.');
    const deployed = await deployContract(providers, {
      compiledContract,
      privateStateId: 'informer',
      initialPrivateState: {},
      args: [
        INFORMER_PARAMS.bucketWidth,
        INFORMER_PARAMS.minContribution,
        INFORMER_PARAMS.maxContribution,
        INFORMER_PARAMS.kAnonymityFloor,
        label32(INFORMER_PARAMS.informerLabel),
        label32(INFORMER_PARAMS.periodLabel),
        hex32(PROVENANCE.policyHash),
        hex32(PROVENANCE.circuitCommitment),
      ],
    });

    const address = deployed.deployTxData.public.contractAddress;
    $('contract-address').textContent = address;
    $('deployed').hidden = false;
    log('Deployed.', 'ok');
    log(`Contract address: ${address}`, 'ok');
  } catch (err) {
    console.error(err);
    log(`${err.name}: ${err.message}`, 'err');
    if (err.cause) log(`cause: ${err.cause.message ?? err.cause}`, 'err');
    const frame = (err.stack ?? '').split(String.fromCharCode(10))[1]?.trim();
    if (frame) log(`at ${frame}`, 'err');
    $('deploy').disabled = false;
  }
});

// Surface the informer parameters this page would deploy, before anything runs.
$('params').textContent = [
  `bucket width      ${INFORMER_PARAMS.bucketWidth}`,
  `band              ${INFORMER_PARAMS.minContribution} to ${INFORMER_PARAMS.maxContribution}`,
  `k-anonymity floor ${INFORMER_PARAMS.kAnonymityFloor}`,
  `informer id       ${INFORMER_PARAMS.informerLabel}`,
  `period            ${INFORMER_PARAMS.periodLabel}`,
  `policy hash       ${PROVENANCE.policyHash.slice(0, 24)}...`,
  `circuit commit    ${PROVENANCE.circuitCommitment.slice(0, 24)}...`,
].join('\n');
