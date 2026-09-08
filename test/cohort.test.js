import { describe, expect, it } from 'vitest';
import { CohortSimulator, bytes32, secretFrom } from './simulator.js';

const ok = (label, raw, bucket) => ({
  secret: secretFrom(label),
  raw,
  bucket,
});

describe('cohort parameters', () => {
  it('publishes the cohort band, bucket width and k-anonymity floor', () => {
    const sim = new CohortSimulator();
    const l = sim.ledger;

    expect(l.bucketWidth).toBe(10_000n);
    expect(l.minContribution).toBe(10_000n);
    expect(l.maxContribution).toBe(1_000_000n);
    expect(l.kAnonymityFloor).toBe(25n);
    expect(l.contributionCount).toBe(0n);
    expect(l.buckets.isEmpty()).toBe(true);
    expect(l.spentNullifiers.isEmpty()).toBe(true);
  });

  it('publishes immutable provenance for the policy and the circuit', () => {
    const sim = new CohortSimulator();
    const l = sim.ledger;

    // Both commitments are readable by anyone, so a reviewer can confirm the
    // rules were not rewritten and every contribution came from one circuit.
    expect(l.policyHash).toEqual(bytes32('policy-v1'));
    expect(l.circuitCommitment).toEqual(bytes32('circuit-v1'));
  });

  it('keeps provenance fixed while contributions accumulate', () => {
    const sim = new CohortSimulator();
    const before = sim.ledger;
    const policy = before.policyHash;
    const circuit = before.circuitCommitment;

    sim.contribute({ secret: secretFrom('alice'), raw: 72_000n, bucket: 7n });
    const after = sim.contribute({
      secret: secretFrom('bob'),
      raw: 84_000n,
      bucket: 8n,
    });

    expect(after.contributionCount).toBe(2n);
    expect(after.policyHash).toEqual(policy);
    expect(after.circuitCommitment).toEqual(circuit);
  });
});

describe('contribution', () => {
  it('records a contribution in the correct bucket', () => {
    const sim = new CohortSimulator();
    const l = sim.contribute(ok('alice', 72_000n, 7n));

    expect(l.contributionCount).toBe(1n);
    expect(l.buckets.member(7n)).toBe(true);
    expect(l.buckets.lookup(7n)).toBe(1n);
    expect(l.spentNullifiers.size()).toBe(1n);
  });

  it('aggregates several contributors without storing individual values', () => {
    const sim = new CohortSimulator();
    sim.contribute(ok('alice', 72_000n, 7n));
    sim.contribute(ok('bob', 78_500n, 7n));
    const l = sim.contribute(ok('carol', 91_000n, 9n));

    expect(l.contributionCount).toBe(3n);
    expect(l.buckets.lookup(7n)).toBe(2n);
    expect(l.buckets.lookup(9n)).toBe(1n);
    expect(l.spentNullifiers.size()).toBe(3n);

    // The ledger holds counts per band and nothing that identifies a person.
    const exposed = Object.keys(l);
    expect(exposed).not.toContain('contributors');
    expect(exposed).not.toContain('salaries');
  });
});

describe('unlinkable uniqueness', () => {
  it('rejects a second contribution from the same participant in the same period', () => {
    const sim = new CohortSimulator();
    sim.contribute(ok('alice', 72_000n, 7n));

    expect(() => sim.contribute(ok('alice', 120_000n, 12n))).toThrow(
      /already contributed/,
    );
  });

  it('lets the same participant contribute again in a different period', () => {
    const q3 = new CohortSimulator({ period: bytes32('2026-Q3') });
    const q4 = new CohortSimulator({ period: bytes32('2026-Q4') });

    q3.contribute(ok('alice', 72_000n, 7n));
    const l = q4.contribute(ok('alice', 84_000n, 8n));

    expect(l.contributionCount).toBe(1n);
    expect(l.spentNullifiers.size()).toBe(1n);
  });
});

describe('anti-gaming constraints', () => {
  it('rejects a contribution below the cohort band', () => {
    const sim = new CohortSimulator();
    expect(() => sim.contribute(ok('mallory', 500n, 0n))).toThrow(/below/);
  });

  it('rejects a contribution above the cohort band', () => {
    const sim = new CohortSimulator();
    expect(() => sim.contribute(ok('mallory', 9_000_000n, 90n))).toThrow(/above/);
  });

  it('rejects a bucket index that does not match the contribution', () => {
    const sim = new CohortSimulator();
    // Earns 72k but claims the 150k band.
    expect(() => sim.contribute(ok('mallory', 72_000n, 15n))).toThrow(
      /bucket index too high/,
    );
    // Earns 72k but claims the 30k band.
    expect(() => sim.contribute(ok('mallory', 72_000n, 3n))).toThrow(
      /bucket index too low/,
    );
  });
});
