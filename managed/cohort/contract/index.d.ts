import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  contributorSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  rawContribution(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  contributionBucket(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
}

export type ImpureCircuits<PS> = {
  contribute(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  contribute(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  contribute(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly bucketWidth: bigint;
  readonly minContribution: bigint;
  readonly maxContribution: bigint;
  readonly kAnonymityFloor: bigint;
  readonly cohortId: Uint8Array;
  readonly period: Uint8Array;
  readonly contributionCount: bigint;
  buckets: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): bigint;
    [Symbol.iterator](): Iterator<[bigint, bigint]>
  };
  spentNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               initBucketWidth_0: bigint,
               initMin_0: bigint,
               initMax_0: bigint,
               initFloor_0: bigint,
               initCohortId_0: Uint8Array,
               initPeriod_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
