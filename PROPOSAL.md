# Product proposal

**Chosen problem:** Anonymous Feedback / Survey — verifiable participation,
private responses.

**Product:** Informer, a privacy-preserving compensation survey. Professionals
contribute what they earn and get back where they stand, without the figure or
their identity ever becoming public.

---

## Why this problem, and why it needs Midnight

Compensation surveys are stuck between two failure modes.

Anonymous surveys accept anything. There is no way to tell a real engineer from
someone typing numbers, so the data cannot be trusted and nobody acts on it.

Verified platforms attach identity to the response. People will not submit their
salary under their own name to a company database, so the data is thin and
skewed toward those with the least to lose.

Every product in this category picks one horn. The reason is structural: on
ordinary infrastructure, verifying a respondent and hiding their response are
the same operation done twice, and whoever performs it sees both halves.

Midnight removes that constraint. Public ledger state and private witness state
live in the same contract, so the network can verify a property of a response it
never receives. That makes "verifiable participation, private responses" a
buildable claim rather than a promise about how a server behaves.

This is the specific reason the project is not a database with extra steps: a
database operator can always read both halves. Here there is no operator who
can, because the figure is never transmitted.

---

## What a participant does

1. Proves they satisfy the published eligibility policy.
2. Enters their annual total compensation. It is written to local private state
   and never leaves the device.
3. The circuit constrains the figure to the band it claims, checks the band
   against the published range, and derives a nullifier from a secret bound to
   this survey and period.
4. The ledger records one band increment and one spent nullifier.
5. The participant reads their position against the distribution, computed on
   their own device from public data.

Verifiable participation is the nullifier. Private response is the witness.

---

## Scope

### In scope now

- One survey instance: software engineers, 4 to 6 years, 2026-Q3
- Self-reported compensation, structurally constrained by the circuit
- One contribution per participant per period, enforced by nullifier
- Public distribution, contribution count, and unique participant count
- A published policy document whose hash is committed on chain at deploy
- A k-anonymity floor published as a contract parameter

### Deliberately out of scope

- **Payroll verification.** Nothing binds the figure to an employer's records.
  The honest description is "structurally validated, self-reported."
- **Sybil resistance.** The contributor secret is not yet bound to an issued
  credential, so one person can generate several. Claiming otherwise would be
  false, so the project does not claim it.
- **Cross-survey identity.** By design. Nullifiers are scoped, so the same
  participant is unlinkable across surveys and periods.

---

## What makes it production-grade

| Concern | Approach |
|---|---|
| Correctness | 10 tests covering band enforcement, bucket constraint in both directions, duplicate rejection, and period scoping |
| Reproducibility | Toolchain pinned to the Mainnet-compatible line; `managed/` rebuilds byte-identically |
| Provenance | `policyHash` and `circuitCommitment` written to ledger state at deploy, so rules cannot be rewritten after contributions begin |
| CI | Compile, install and test on every push |
| Honesty | Limitations documented in `POLICY.md` §5 and the README rather than left for a reviewer to find |

---

## Roadmap

| Stage | Work |
|---|---|
| Now | Survey instance live on Preprod, contributions accepted, duplicates rejected |
| Next | Eligibility bound to an issued credential, closing the sybil gap |
| Then | Enforce the k-anonymity floor on reads rather than only publishing it |
| Later | Multiple concurrent surveys; compensation attestation replacing self-report |

The eligibility layer is the important one. It converts "one contribution per
secret" into "one contribution per verified participant", which is what makes
the aggregate worth trusting.

---

## Success criteria

A distribution that a working engineer would actually consult, built from
responses none of them would have published under their own name, where any
reader can verify from ledger state alone that no individual figure was ever
disclosed.
