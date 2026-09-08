# Informer

**Know where you stand without revealing where you are.**

Informer is a privacy-preserving contribution primitive on Midnight. Eligible
participants contribute a private data point, the network verifies that the
contribution came from an eligible participant who has not already contributed
to that scope, and the only thing that becomes public is the aggregate
distribution.

Compensation is the first contribution category. The contract is not
compensation specific.

---

## The idea

Anonymous compensation surveys are untrustworthy because anyone can submit
anything. Verified compensation databases are unusable because people will not
attach their name to their salary. Every product in this space is stuck on one
horn or the other.

Informer separates the two claims. A participant proves *eligibility* against a
published Informer policy, and separately *contributes* a compensation figure.
The contract learns that an eligible participant contributed to a given band,
and that the same participant has not contributed before in this period. It
does not learn who they are, and it never receives the underlying figure. The
public result is a distribution people can act on: where does my compensation
sit, relative to a group whose membership rules I can verify.

---

## What is public and what is private

This distinction is the whole design, so it is worth being precise.

### Public ledger state

| Field | Type | Why it is public |
|---|---|---|
| `bucketWidth` | `Uint<64>` | Participants must be able to audit the band granularity they contribute under |
| `minContribution` / `maxContribution` | `Uint<64>` | The sanity band that bounds gaming is only meaningful if it is auditable |
| `kAnonymityFloor` | `Uint<64>` | The threshold below which a distribution should not be treated as publishable |
| `informerId` / `period` | `Bytes<32>` | Nullifier domain separation, which must be public to be verifiable |
| `contributionCount` | `Counter` | The aggregate size |
| `buckets` | `Map<Uint<8>, Uint<64>>` | The distribution itself, which is the product |
| `spentNullifiers` | `Set<Bytes<32>>` | Public evidence that a private eligibility has been consumed |

### Private witness state

| Witness | Type | Never leaves the device |
|---|---|---|
| `contributorSecret()` | `Bytes<32>` | The participant's secret. The nullifier is derived from it, and the derivation is one way |
| `rawContribution()` | `Uint<64>` | The actual compensation figure |
| `contributionBucket()` | `Uint<8>` | The claimed band, constrained in circuit against `rawContribution()` |

### How disclose() is used

In Compact, circuit inputs are private by default. `disclose()` does not make a
value public; it records that the developer considers this specific exposure
intentional. Informer uses it in exactly two places, and both are deliberate:

1. **Constructor parameters.** The Informer's band, bucket width and
   k-anonymity floor are written to the ledger so participants can audit the
   terms they are contributing under.
2. **The nullifier and the bucket index.** These are the two values that must
   reach public state for the aggregate to work. The nullifier is a one way
   function of a secret the contract never sees. The bucket index is a band,
   not a figure.

The raw contribution is never disclosed anywhere in the contract.

---

## Two design decisions worth explaining

### The bucket is a witness, and the circuit constrains it

Compact has no division operator, by design: division is expensive inside a ZK
circuit. So the bucket index is supplied as a private witness and pinned by
multiplication instead:

```
lower = bucket * bucketWidth
assert raw >= lower
assert raw <  lower + bucketWidth
```

Exactly one bucket index satisfies both constraints for any given raw value, so
a participant cannot claim a band they are not in. The test suite proves this
in both directions.

This also gives the project a real upgrade path. Today `rawContribution()` is
self reported. When compensation attestation lands later, the same constraint
derives the band from an attested figure with no change to the aggregate logic.

### Nullifiers are scoped, not permanent identities

The nullifier is derived as:

```
nullifier = persistentHash([contributorSecret, informerId, period])
```

Binding the nullifier to the Informer and the period means the same participant
produces an unrelated nullifier in a different Informer or a different period.
That gives uniqueness per scope without creating a reusable public identifier
that could be correlated across scopes.

---

## Signing: no private key lives in this project

Deployment and contributions are signed by the Lace extension through the
Midnight DApp connector. The page asks Lace to balance and submit a
transaction; it cannot read a key.

There is deliberately no seed phrase in this repo, in `.env`, or in any
environment variable. A deploy key sitting in a dotfile is a hot key, and the
project does not need one. `.env` holds only public addresses and the local
proof server URL, and is gitignored so a public repo does not permanently link
a GitHub account to a wallet.

---

## Honest limitations

These are stated deliberately rather than left for a reviewer to discover.

- **Compensation is self reported.** Eligibility is what gets verified. The
  correct description of the current data is *verified participant,
  self reported compensation*. Compensation attestation is a later stage.
- **Small groups leak.** A distribution over a handful of contributions is
  close to individual data. The `kAnonymityFloor` parameter exists so an Informer
  can withhold its distribution until the aggregate is large enough to hide an
  individual inside it.
- **Timing correlation is a residual risk.** Public bucket increments are
  observable on chain. An observer who knows when a specific person contributed
  can learn something from the increment that follows. Batching and delayed
  aggregate publication reduce this. It is not fully eliminated.
- **Eligibility attestation will introduce a trusted edge.** When GitHub backed
  eligibility lands, an attestation service will verify the account and issue a
  credential. That service is trusted to attest correctly. It never sees the
  compensation figure, and the chain never sees the account. This is a trusted
  attestation edge and is named as such rather than described as trustless.
- **"Unlinkable contribution", not "anonymous".** The defensible claim is that
  the contract verifies an eligible participant contributed and prevents
  duplicate contribution within a scope, without learning the participant's
  identity.

---

## Running locally

Prerequisites: WSL2 with Ubuntu (on Windows), Docker, Node 22.

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source $HOME/.local/bin/env
compact update 0.31
compact compile src/informer.compact managed/informer
npm install
npm test
npm run preflight   # checks artifacts, toolchain pinning, proof server, indexer, node
npm run dev         # serves the DApp on http://localhost:5173
```

The DApp needs the Lace extension, unlocked and set to Preprod, plus a running
proof server.

### Toolchain version, and why it is pinned

Toolchain 0.34.0 targets ledger version 9, which is not yet deployed on
Midnight Mainnet. The 0.34.0 release notes are explicit that contracts intended
for the current Mainnet should be built with 0.31.x. Since this project is
headed for a Mainnet deployment, it is pinned to:

- Compact toolchain **0.31.1**
- Compact language **0.23.0**
- Compact runtime **0.16.0**

### Proof server

```bash
docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
```

---

## Deployment

| Network | Contract address |
|---|---|
| Preprod | pending |
| Mainnet | not yet deployed |

---

## Tests

```bash
npm test
```

Ten tests covering Informer parameter publication, provenance commitments,
bucket aggregation across
multiple contributors, duplicate rejection via nullifier, period scoped
re-contribution, band enforcement, and bucket constraint enforcement in both
directions.
