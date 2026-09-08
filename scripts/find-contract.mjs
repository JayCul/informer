// Finds an Informer deployment on Preprod and proves it is ours.
//
// Useful because the post-submit indexer watch currently fails (see README),
// so a deploy can succeed on chain without the app reporting the address.
//
// Identification does not rely on guessing: the contract writes policyHash and
// circuitCommitment into ledger state at deploy, so a deployment is ours if and
// only if both commitments appear in its on-chain state.
//
//   node scripts/find-contract.mjs [blocksToScan]
//   node scripts/find-contract.mjs <contractAddress>   (direct lookup)
import { PROVENANCE } from '../src/provenance.js';

const ENDPOINT = 'https://indexer.preprod.midnight.network/api/v4/graphql';
const ARG = process.argv[2] ?? '200';
const DIRECT = /^[0-9a-fA-F]{64}$/.test(ARG) ? ARG.toLowerCase() : null;
const DEPTH = DIRECT ? 0 : Number(ARG);

const gql = async (query, variables) => {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors).slice(0, 300));
  return body.data;
};

const BLOCK_Q = `query($h: Int!) {
  block(offset: { height: $h }) {
    height timestamp
    transactions {
      hash
      contractActions { __typename ... on ContractDeploy { address } }
    }
  }
}`;

const STATE_Q = `query($a: HexEncoded!) {
  contractAction(address: $a) {
    __typename address state
    transaction { hash block { height timestamp } }
  }
}`;

const report = (d) => {
  console.log(`  address  ${d.address}`);
  console.log(`  tx       ${d.tx}`);
  console.log(`  block    ${d.height}  ${d.when}`);
  console.log(`  verified policyHash + circuitCommitment present in state
`);
};

if (DIRECT) {
  const detail = await gql(STATE_Q, { a: DIRECT });
  const action = detail.contractAction;
  if (!action) {
    console.log(`No contract found at ${DIRECT}`);
    process.exit(1);
  }
  const state = (action.state ?? '').toLowerCase();
  const isOurs =
    state.includes(PROVENANCE.policyHash) &&
    state.includes(PROVENANCE.circuitCommitment);
  console.log(`${action.__typename} at ${action.address}
`);
  if (!isOurs) {
    console.log('  NOT an Informer deployment: provenance commitments absent.');
    process.exit(1);
  }
  report({
    address: action.address,
    tx: action.transaction.hash,
    height: action.transaction.block.height,
    when: new Date(action.transaction.block.timestamp).toISOString(),
  });
  process.exit(0);
}

const head = await gql('{ block { height } }');
const top = head.block.height;
console.log(`scanning blocks ${top - DEPTH + 1}..${top}`);

const ours = [];
for (let h = top; h > top - DEPTH; h -= 1) {
  let data;
  try {
    data = await gql(BLOCK_Q, { h });
  } catch {
    continue;
  }
  for (const tx of data.block?.transactions ?? []) {
    for (const action of tx.contractActions ?? []) {
      if (action.__typename !== 'ContractDeploy') continue;

      const detail = await gql(STATE_Q, { a: action.address });
      const state = (detail.contractAction?.state ?? '').toLowerCase();
      const isOurs =
        state.includes(PROVENANCE.policyHash) &&
        state.includes(PROVENANCE.circuitCommitment);
      if (isOurs) {
        ours.push({
          address: action.address,
          tx: tx.hash,
          height: data.block.height,
          when: new Date(data.block.timestamp).toISOString(),
        });
      }
    }
  }
}

if (ours.length === 0) {
  console.log('\nNo Informer deployment found in that range.');
  console.log('Try a larger depth: node scripts/find-contract.mjs 1000');
  process.exitCode = 1;
} else {
  console.log(`\nFound ${ours.length} Informer deployment(s):\n`);
  for (const d of ours) {
    console.log(`  address  ${d.address}`);
    console.log(`  tx       ${d.tx}`);
    console.log(`  block    ${d.height}  ${d.when}`);
    console.log(`  verified policyHash + circuitCommitment present in state\n`);
  }
}
