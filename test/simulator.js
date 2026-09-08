import {
  createConstructorContext,
  createCircuitContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../managed/informer/contract/index.js';

const COIN_PUBLIC_KEY = '0'.repeat(64);

// The witnesses read exclusively from local private state. Nothing here is
// visible to the network; the circuit consumes these values and only the
// constrained, disclosed outputs reach the ledger.
export const witnesses = {
  contributorSecret: ({ privateState }) => [privateState, privateState.secret],
  rawContribution: ({ privateState }) => [privateState, privateState.raw],
  contributionBucket: ({ privateState }) => [privateState, privateState.bucket],
};

export const secretFrom = (label) => {
  const bytes = new Uint8Array(32);
  const encoded = new TextEncoder().encode(label);
  bytes.set(encoded.subarray(0, 32));
  return bytes;
};

export const bytes32 = (label) => secretFrom(label);

/**
 * Minimal in-memory simulator for the Informer contract.
 * Mirrors how a wallet would drive the circuit, without a proof server.
 */
export class InformerSimulator {
  constructor({
    bucketWidth = 10_000n,
    min = 10_000n,
    max = 1_000_000n,
    floor = 25n,
    informerId = bytes32('software-engineer-4-6y'),
    period = bytes32('2026-Q3'),
    policyHash = bytes32('policy-v1'),
    circuitCommitment = bytes32('circuit-v1'),
  } = {}) {
    this.contract = new Contract(witnesses);
    this.address = sampleContractAddress();

    const seedPrivateState = { secret: secretFrom('seed'), raw: 0n, bucket: 0n };
    const { currentContractState, currentPrivateState } =
      this.contract.initialState(
        createConstructorContext(seedPrivateState, COIN_PUBLIC_KEY),
        bucketWidth,
        min,
        max,
        floor,
        informerId,
        period,
        policyHash,
        circuitCommitment,
      );

    this.state = currentContractState.data;
    this.privateState = currentPrivateState;
  }

  get ledger() {
    return ledger(this.state);
  }

  /** Run one contribution as a participant holding `secret`. */
  contribute({ secret, raw, bucket }) {
    const privateState = { secret, raw, bucket };
    const context = createCircuitContext(
      this.address,
      COIN_PUBLIC_KEY,
      this.state,
      privateState,
    );

    const { context: next } = this.contract.impureCircuits.contribute(context);
    this.state = next.currentQueryContext.state;
    return this.ledger;
  }
}
