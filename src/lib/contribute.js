// Calling the contribute circuit from the browser.
//
// The circuit takes no arguments. Every input reaches it as a witness read from
// local private state, which is the whole point: the figure is an input to the
// proof, never a parameter of the transaction.
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

import { Contract, ledger } from '../../managed/informer/contract/index.js';
import { CONTRACT_ADDRESS, INFORMER_PARAMS } from '../config.js';

export const PRIVATE_STATE_ID = 'informer';

/**
 * Witnesses read from local private state and nothing else. Whatever these
 * return is consumed inside the circuit; only what the circuit discloses
 * reaches the chain.
 */
export const witnesses = {
  contributorSecret: ({ privateState }) => [privateState, privateState.secret],
  rawContribution: ({ privateState }) => [privateState, privateState.raw],
  contributionBucket: ({ privateState }) => [privateState, privateState.bucket],
};

export const compiledInformer = CompiledContract.make('informer', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
);

/** Bucket index for a figure, matching the constraint the circuit enforces. */
export const bucketFor = (raw, width = INFORMER_PARAMS.bucketWidth) =>
  raw / width;

/**
 * The contributor secret is what makes one person one contribution. It is
 * generated once, kept in local private state, and never transmitted: the
 * chain only ever sees a one-way hash of it bound to this Informer and period.
 */
export async function getOrCreateSecret(privateStateProvider) {
  const existing = await privateStateProvider.get(PRIVATE_STATE_ID);
  if (existing?.secret && existing.secret.length === 32) {
    return { secret: existing.secret, created: false };
  }
  const secret = crypto.getRandomValues(new Uint8Array(32));
  return { secret, created: true };
}

/** Reads the public ledger state of the deployed Informer. */
export async function readPublicState(providers, address = CONTRACT_ADDRESS) {
  const contractState = await providers.publicDataProvider.queryContractState(address);
  if (!contractState) return null;
  const l = ledger(contractState.data);

  const buckets = [];
  for (const [index, count] of l.buckets) {
    buckets.push({ index, count });
  }
  buckets.sort((a, b) => Number(a.index - b.index));

  return {
    contributionCount: l.contributionCount,
    bucketWidth: l.bucketWidth,
    kAnonymityFloor: l.kAnonymityFloor,
    nullifierCount: l.spentNullifiers.size(),
    buckets,
  };
}

/**
 * Submits one contribution.
 *
 * `raw` never leaves this function's caller: it is written to local private
 * state, read by a witness inside the circuit, and constrained against the
 * bucket index. The transaction carries a proof, not the figure.
 */
export async function contribute({ providers, raw, log }) {
  const bucket = bucketFor(raw);

  // The private state store is keyed by contract address as well as account,
  // and throws on any read or write before the address is set.
  providers.privateStateProvider.setContractAddress(CONTRACT_ADDRESS);

  const { secret, created } = await getOrCreateSecret(providers.privateStateProvider);
  log(created ? 'Generated a new contributor secret (stays on this device).' : 'Reusing the contributor secret already on this device.');

  await providers.privateStateProvider.set(PRIVATE_STATE_ID, {
    secret,
    raw,
    bucket,
  });

  log('Attaching to the deployed Informer.');
  const found = await findDeployedContract(providers, {
    compiledContract: compiledInformer,
    contractAddress: CONTRACT_ADDRESS,
    privateStateId: PRIVATE_STATE_ID,
  });

  log('Proving and submitting. The wallet will ask you to approve.');
  const result = await found.callTx.contribute();

  return {
    bucket,
    txId: result?.public?.txId ?? result?.txId,
    txHash: result?.public?.txHash ?? result?.txHash,
    blockHeight: result?.public?.blockHeight ?? result?.blockHeight,
  };
}
