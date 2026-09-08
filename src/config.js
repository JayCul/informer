// Public Midnight network configuration. Safe to commit: these are the same
// endpoints every Preprod participant uses.
export const PREPROD = {
  name: 'preprod',
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWs: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
};

// Cohort parameters for the first live cohort.
// Bands are USD-major-units; 10_000 gives $10k buckets.
export const FIRST_COHORT = {
  bucketWidth: 10_000n,
  minContribution: 10_000n,
  maxContribution: 1_000_000n,
  kAnonymityFloor: 25n,
  cohortLabel: 'software-engineer-4-6y',
  periodLabel: '2026-Q3',
};

export const label32 = (label) => {
  const bytes = new Uint8Array(32);
  bytes.set(new TextEncoder().encode(label).subarray(0, 32));
  return bytes;
};
