# Informer eligibility policy

**Informer ID:** `software-engineer-4-6y`
**Period:** `2026-Q3`

The SHA-256 of this file is committed on chain as `policyHash` when the Informer
is deployed. If this file changes, the hash no longer matches, and anyone can
tell that the rules were rewritten after contributions began.

---

## 1. Who may contribute

A participant is eligible for this Informer if all of the following hold:

- They work, or worked during the period, as a software engineer.
- They have between 4 and 6 years of professional experience, counted from
  first paid full-time engineering employment.
- They hold a credential issued by the Informer attestation service against
  this policy.

Until the attestation layer ships, eligibility is **not enforced by the
contract**. See section 5.

## 2. What is contributed

A single annual total compensation figure for the period, in USD, comprising
base salary plus cash bonus plus the annualised value of equity granted.

The figure must fall within the band:

| Parameter | Value |
|---|---|
| Minimum | 10,000 |
| Maximum | 1,000,000 |
| Bucket width | 10,000 |

Contributions outside the band are rejected by the circuit.

## 3. What becomes public

Exactly two things per contribution:

- The bucket index the figure falls in.
- A nullifier scoped to this Informer and period.

The figure itself, the participant's identity, and every other field collected
locally remain private and never reach the chain.

## 4. One contribution per participant

A participant may contribute once per Informer per period. The contract enforces
this by recording a nullifier derived from the participant's secret, the Informer
identifier and the period. The same participant produces an unrelated nullifier
in a different Informer or period, so contributions cannot be correlated across
scopes.

## 5. Known limitations of this policy version

Stated here rather than left for a reader to discover.

- **Compensation is self reported.** Nothing binds the figure to payroll
  reality. The correct description of this data is *structurally validated,
  self reported compensation*.
- **Eligibility is not yet enforced on chain.** The contributor secret is not
  yet bound to an issued credential, so the contract cannot currently verify
  that a contributor satisfies sections 1 and 2, and cannot prevent one person
  from contributing under several secrets. Claims of sybil resistance should
  not be made for this version.
- **The k-anonymity floor is published, not enforced.** `kAnonymityFloor` is
  recorded on chain as the threshold below which the distribution should not be
  treated as publishable. The contract does not currently gate reads on it.
- **Attestation will introduce a trusted edge.** When credential issuance
  ships, the attestation service is trusted to verify correctly. It will never
  see the compensation figure, and the chain will never see the underlying
  account.

## 6. Versioning

This policy is versioned by its own hash. A change to the eligibility rules,
the band, or the bucket width requires a new Informer deployment with a new
`policyHash`. Existing deployments are immutable.
