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

## The privacy claim

Stated narrowly enough to be tested, and no wider.

**Claim.** For each contribution, the network verifies that a participant
holding an unspent credential for this Informer and period contributed a figure
inside the published band, and that the figure falls in the band index recorded,
without the network, the contract, or any observer learning the figure or the
participant's identity.

### What backs it

| Claim | Mechanism | Where to look |
|---|---|---|
| The figure never reaches the chain | `rawContribution()` is a witness, consumed inside the circuit and never disclosed | `src/informer.compact` |
| The band is truthful | `bucket * width <= raw < (bucket+1) * width`, so exactly one index satisfies it | `contribute` circuit |
| The figure is inside the band | `raw >= minContribution`, `raw <= maxContribution` | `contribute` circuit |
| One contribution per participant per period | nullifier membership check before insert | `spentNullifiers` |
| Nullifiers do not correlate across scopes | `persistentHash([secret, informerId, period])` | `contribute` circuit |
| The secret never leaves the device | held in encrypted local private state, only ever hashed | `app/privateStorage.js` |

### How to observe it

1. Contribute a figure. The log shows the circuit proving and submitting.
2. Read the public state. The count and one band increment. No figure appears
   anywhere in ledger state, because there is no field that could hold one.
3. Contribute again from the same browser. It is rejected as
   `already contributed in this period`. The contract enforced uniqueness
   without ever learning who the participant is.

Step 3 is the observable privacy behaviour: something proven without being
shown.

### What the claim does not cover

- **Truthfulness of the figure.** It is self reported. The circuit constrains
  its internal consistency, not its correspondence to payroll.
- **Sybil resistance.** The contributor secret is not yet bound to an issued
  credential, so one person can generate several secrets. Until the eligibility
  layer ships, "one contribution per participant" means one per secret.
- **Traffic analysis.** Bucket increments are public and timestamped. An
  observer who knows when a specific person contributed can learn something
  from the increment that follows.

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

### The proof server, and why the hosted demo needs one

Proofs are generated locally, never on a server. That is the point, and it is
also the one thing a hosted page cannot do for you.

The deployed demo therefore checks for a proof server on `127.0.0.1:6300` and
says so plainly when it is missing. Everything that does not need proving still
works without it: the live distribution, the contribution count, the
k-anonymity progress, and the whole privacy explanation are read straight from
the indexer with no wallet and no proof server.

To contribute, run:

```bash
docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
```

then press "Check again" on the page. A browser will happily reach
`http://127.0.0.1` from an HTTPS page, because localhost counts as a
trustworthy origin and is not treated as mixed content.

### On Windows: `compact` is not the Compact compiler

PowerShell and CMD already have a built-in `compact.exe`, the NTFS file
compression tool. Running `compact compile ...` outside WSL silently runs that
instead and reports a compression ratio rather than compiling anything, which
looks like success:

```
Of 2 files within 3 directories
0 are compressed and 2 are not compressed.
The compression ratio is 1.0 to 1.
```

The Midnight compiler only exists inside WSL. Either run the build from an
Ubuntu terminal, or route through WSL from PowerShell in one command:

```powershell
wsl -d Ubuntu -- bash -lc "source ~/.local/bin/env && cd /mnt/c/path/to/informer && compact compile src/informer.compact managed/informer"
npm run verify
```

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
| Preprod | `7c4f5fcc486dc6e36ee13003173d1d2186170bdbb00292f9c403182d52c718b5` |
| Mainnet | not yet deployed |

Deploy transaction `0e3a8860cd5fc41db5e238add4bd1c7aca18eba083c5f1c6c7b74f394908ace1`,
block 2465867, 2026-09-08.

Two earlier deployments are also live and superseded: `f922a567...`
(block 2460183), made before the confirmation watch was fixed, so the app never
reported its address; and `5fbb4537...` (block 2460317). The address above is
the canonical one.

Identified by its own provenance rather than by assumption: the deployment is
ours because both `policyHash` and `circuitCommitment` appear in its on-chain
state. `node scripts/find-contract.mjs` re-runs that check against Preprod.

### Confirmation watch

`MidnightProvider.submitTx` has to return a transaction identifier, which
midnight-js then hands to `watchForTxData`. The DApp connector's
`submitTransaction` resolves to `void`, so there is nothing to return from the
wallet call. The identifier is taken from the transaction instead, via the
ledger's `identifiers()`. The ledger documents `transactionHash()` as unsuitable
here, because transactions can be merged, and `identifiers()` as the set that
may be used to watch for a specific transaction.

Verified against the real deployment rather than in the abstract: the raw
transaction is fetched from the indexer, decoded by the same code path that
decodes the wallet's balanced transaction, re-encoded byte for byte, and the
identifier computed from it is then used in the exact query `watchForTxData`
issues. It resolves to transaction `69cb7398...`.

---

## Tests

```bash
npm test      # unit tests
npm run verify   # toolchain, circuits, witnesses, artifacts, provenance, deployment
```

`npm run verify` reads only real build artifacts and prints a single summary of
what this tree actually contains.

Ten tests covering Informer parameter publication, provenance commitments,
bucket aggregation across
multiple contributors, duplicate rejection via nullifier, period scoped
re-contribution, band enforcement, and bucket constraint enforcement in both
directions.
