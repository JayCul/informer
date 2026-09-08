import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';

import { Contract } from '../managed/cohort/contract/index.js';
import { PREPROD, FIRST_COHORT, label32 } from '../src/config.js';
import { connectLace } from './lace.js';

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
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: 'cohort-private-state',
      }),
      publicDataProvider: indexerPublicDataProvider(
        PREPROD.indexer,
        PREPROD.indexerWs,
      ),
      // Serves the compiled circuits and keys from public/zk/cohort.
      // Deliberately not /managed: that URL would collide with the real
      // managed/ sources Vite transforms, and public/ files are served raw.
      zkConfigProvider: new FetchZkConfigProvider(
        `${window.location.origin}/zk/cohort`,
        fetch.bind(window),
      ),
      proofProvider: httpClientProofProvider(PREPROD.proofServer),
      walletProvider: session.walletProvider,
      midnightProvider: session.midnightProvider,
    };

    log('Deploying. The wallet will ask you to approve the transaction.');
    const deployed = await deployContract(providers, {
      contract: new Contract(witnesses),
      privateStateId: 'cohort',
      initialPrivateState: {},
      args: [
        FIRST_COHORT.bucketWidth,
        FIRST_COHORT.minContribution,
        FIRST_COHORT.maxContribution,
        FIRST_COHORT.kAnonymityFloor,
        label32(FIRST_COHORT.cohortLabel),
        label32(FIRST_COHORT.periodLabel),
      ],
    });

    const address = deployed.deployTxData.public.contractAddress;
    $('contract-address').textContent = address;
    $('deployed').hidden = false;
    log('Deployed.', 'ok');
    log(`Contract address: ${address}`, 'ok');
  } catch (err) {
    console.error(err);
    log(err.message, 'err');
    $('deploy').disabled = false;
  }
});

// Surface the cohort parameters this page would deploy, before anything runs.
$('params').textContent = [
  `bucket width      ${FIRST_COHORT.bucketWidth}`,
  `band              ${FIRST_COHORT.minContribution} to ${FIRST_COHORT.maxContribution}`,
  `k-anonymity floor ${FIRST_COHORT.kAnonymityFloor}`,
  `cohort            ${FIRST_COHORT.cohortLabel}`,
  `period            ${FIRST_COHORT.periodLabel}`,
].join('\n');
