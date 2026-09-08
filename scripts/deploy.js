// Deploy the Cohort contract to Midnight Preprod.
//
// Run:  npm run proof-server        (in a second terminal)
//       npm run deploy:preprod
//
// The deploying wallet's seed is read from MIDNIGHT_SEED in .env, which is
// gitignored. The seed is passed to the local wallet SDK and nowhere else: it
// is never logged, never sent to the indexer or node, and never printed.
import 'dotenv/config';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';

import { Contract } from '../managed/cohort/contract/index.js';
import { PREPROD, FIRST_COHORT, label32 } from '../src/config.js';
import { createDeployWallet } from './wallet.js';

// The deployer runs no circuits, so the witnesses are never invoked here. They
// are required to construct the Contract object.
const unusedWitnesses = {
  contributorSecret: ({ privateState }) => [privateState, new Uint8Array(32)],
  rawContribution: ({ privateState }) => [privateState, 0n],
  contributionBucket: ({ privateState }) => [privateState, 0n],
};

const seed = process.env.MIDNIGHT_SEED;
if (!seed) {
  console.error(
    'MIDNIGHT_SEED is not set.\n' +
      'Add your Preprod wallet seed to .env yourself (the file is gitignored).\n' +
      'Do not paste it into a chat or a commit.',
  );
  process.exit(1);
}

const proofServer = process.env.PROOF_SERVER ?? PREPROD.proofServer;

console.log('network      ', PREPROD.name);
console.log('indexer      ', PREPROD.indexer);
console.log('node         ', PREPROD.node);
console.log('proof server ', proofServer);

const wallet = await createDeployWallet({ seed, network: PREPROD });

const providers = {
  privateStateProvider: levelPrivateStateProvider({
    privateStateStoreName: 'cohort-private-state',
  }),
  publicDataProvider: indexerPublicDataProvider(
    PREPROD.indexer,
    PREPROD.indexerWs,
  ),
  zkConfigProvider: new NodeZkConfigProvider('managed/cohort'),
  proofProvider: httpClientProofProvider(proofServer),
  walletProvider: wallet.walletProvider,
  midnightProvider: wallet.midnightProvider,
};

console.log('\ndeploying Cohort with parameters:');
console.table({
  bucketWidth: FIRST_COHORT.bucketWidth.toString(),
  minContribution: FIRST_COHORT.minContribution.toString(),
  maxContribution: FIRST_COHORT.maxContribution.toString(),
  kAnonymityFloor: FIRST_COHORT.kAnonymityFloor.toString(),
  cohort: FIRST_COHORT.cohortLabel,
  period: FIRST_COHORT.periodLabel,
});

const deployed = await deployContract(providers, {
  contract: new Contract(unusedWitnesses),
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
console.log('\nDEPLOYED');
console.log('contract address:', address);
console.log('\nPut this in the README deployment table.');

await wallet.close?.();
