import { describe, it, expect } from 'vitest';
import {
  analyzeContractStorage,
  computeLedgersRemaining,
  estimateBumpCostStroops,
  formatReport,
  isNearExpiration,
  DEFAULT_RENT_FEE_MODEL,
} from './storageAnalyzer';
import type { GetLedgerEntriesResult, LedgerEntriesFetcher, StorageKeyDescriptor } from './types';

function xdrOfSize(bytes: number): string {
  return Buffer.alloc(bytes, 1).toString('base64');
}

// ---------------------------------------------------------------------------
// 1. TTL-remaining calculation correctness from ledger sequence numbers
// ---------------------------------------------------------------------------

describe('computeLedgersRemaining', () => {
  it('computes remaining ledgers as liveUntilLedgerSeq - currentLedger', () => {
    expect(computeLedgersRemaining(1_000_500, 1_000_000)).toBe(500);
  });

  it('returns a negative number for an already-expired entry', () => {
    expect(computeLedgersRemaining(999_000, 1_000_000)).toBe(-1_000);
  });

  it('returns zero when the entry expires exactly at the current ledger', () => {
    expect(computeLedgersRemaining(1_000_000, 1_000_000)).toBe(0);
  });

  it('returns null when liveUntilLedgerSeq is unknown', () => {
    expect(computeLedgersRemaining(null, 1_000_000)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. correctly identifies keys nearing the expiration threshold
// ---------------------------------------------------------------------------

describe('isNearExpiration', () => {
  it('flags an entry with ledgers remaining below the threshold', () => {
    expect(isNearExpiration(5_000, 10_000)).toBe(true);
  });

  it('flags an entry exactly at the threshold (inclusive boundary)', () => {
    expect(isNearExpiration(10_000, 10_000)).toBe(true);
  });

  it('does not flag an entry comfortably above the threshold', () => {
    expect(isNearExpiration(50_000, 10_000)).toBe(false);
  });

  it('flags an already-expired (negative remaining) entry', () => {
    expect(isNearExpiration(-100, 10_000)).toBe(true);
  });

  it('does not flag when remaining is unknown', () => {
    expect(isNearExpiration(null, 10_000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. fee-estimation math is internally consistent
// ---------------------------------------------------------------------------

describe('estimateBumpCostStroops', () => {
  it('doubling bump-ledgers roughly doubles the variable portion of the cost', () => {
    const entrySize = 1_000;
    const costAt100k = estimateBumpCostStroops(entrySize, 100_000);
    const costAt200k = estimateBumpCostStroops(entrySize, 200_000);

    // Subtract the flat base fee before comparing, since the base fee is
    // constant and would otherwise dilute the ratio at small bump sizes.
    const variableAt100k = costAt100k - BigInt(Math.ceil(DEFAULT_RENT_FEE_MODEL.baseFeeStroops));
    const variableAt200k = costAt200k - BigInt(Math.ceil(DEFAULT_RENT_FEE_MODEL.baseFeeStroops));

    expect(variableAt200k).toBe(variableAt100k * 2n);
  });

  it('doubling entry size roughly doubles the variable portion of the cost', () => {
    const bumpLedgers = 50_000;
    const costSmall = estimateBumpCostStroops(500, bumpLedgers);
    const costLarge = estimateBumpCostStroops(1_000, bumpLedgers);

    const base = BigInt(Math.ceil(DEFAULT_RENT_FEE_MODEL.baseFeeStroops));
    expect(costLarge - base).toBe((costSmall - base) * 2n);
  });

  it('a zero-ledger bump costs only the flat base fee', () => {
    const cost = estimateBumpCostStroops(10_000, 0);
    expect(cost).toBe(BigInt(Math.ceil(DEFAULT_RENT_FEE_MODEL.baseFeeStroops)));
  });

  it('rejects negative entry size or bump ledgers', () => {
    expect(() => estimateBumpCostStroops(-1, 100)).toThrow();
    expect(() => estimateBumpCostStroops(100, -1)).toThrow();
  });

  it('cost scales with a custom fee model', () => {
    const cheapModel = { stroopsPerByteLedger: 0.001, baseFeeStroops: 10 };
    const expensiveModel = { stroopsPerByteLedger: 0.1, baseFeeStroops: 10 };

    const cheap = estimateBumpCostStroops(1_000, 10_000, cheapModel);
    const expensive = estimateBumpCostStroops(1_000, 10_000, expensiveModel);
    expect(expensive).toBeGreaterThan(cheap);
  });
});

// ---------------------------------------------------------------------------
// analyzeContractStorage: end-to-end with an injected fetcher (no network)
// ---------------------------------------------------------------------------

describe('analyzeContractStorage', () => {
  const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAITA4';

  function fakeFetcher(
    responses: Array<{ xdr: string; liveUntilLedgerSeq?: number } | null>,
    latestLedger = 1_000_000
  ): LedgerEntriesFetcher {
    return async (_keys: StorageKeyDescriptor[]): Promise<GetLedgerEntriesResult> => {
      return {
        latestLedger,
        entries: responses.filter((r): r is { xdr: string; liveUntilLedgerSeq?: number } => r !== null),
      };
    };
  }

  it('reports the instance entry plus supplied persistent/temporary keys', async () => {
    const fetcher = fakeFetcher([
      { xdr: xdrOfSize(64), liveUntilLedgerSeq: 1_050_000 },
      { xdr: xdrOfSize(32), liveUntilLedgerSeq: 1_005_000 },
      { xdr: xdrOfSize(16), liveUntilLedgerSeq: 1_000_500 },
    ]);

    const report = await analyzeContractStorage(
      {
        contractId: CONTRACT_ID,
        rpcUrl: 'https://example.invalid',
        bumpLedgers: 100_000,
        warnThresholdLedgers: 10_000,
        persistentKeys: ['BALANCE'],
        temporaryKeys: ['SESSION'],
      },
      fetcher
    );

    expect(report.entries).toHaveLength(3);
    expect(report.entries[0].type).toBe('instance');
    expect(report.entries[1].type).toBe('persistent');
    expect(report.entries[1].label).toBe('BALANCE');
    expect(report.entries[2].type).toBe('temporary');
    expect(report.entries[2].label).toBe('SESSION');
  });

  it('flags entries within the warn threshold and leaves others unflagged', async () => {
    const fetcher = fakeFetcher([
      { xdr: xdrOfSize(64), liveUntilLedgerSeq: 1_500_000 }, // far from expiring
      { xdr: xdrOfSize(64), liveUntilLedgerSeq: 1_005_000 }, // 5,000 remaining: near
    ]);

    const report = await analyzeContractStorage(
      {
        contractId: CONTRACT_ID,
        rpcUrl: 'https://example.invalid',
        bumpLedgers: 100_000,
        warnThresholdLedgers: 10_000,
        persistentKeys: ['SOON_TO_EXPIRE'],
      },
      fetcher
    );

    expect(report.entries[0].nearExpiration).toBe(false);
    expect(report.entries[1].nearExpiration).toBe(true);
    expect(report.entries[1].ledgersRemaining).toBe(5_000);
  });

  it('marks a missing entry as not present with null TTL fields', async () => {
    const fetcher = fakeFetcher([null]);

    const report = await analyzeContractStorage(
      {
        contractId: CONTRACT_ID,
        rpcUrl: 'https://example.invalid',
        bumpLedgers: 100_000,
        warnThresholdLedgers: 10_000,
      },
      fetcher
    );

    expect(report.entries[0].present).toBe(false);
    expect(report.entries[0].liveUntilLedgerSeq).toBeNull();
    expect(report.entries[0].ledgersRemaining).toBeNull();
    expect(report.entries[0].estimatedBumpCostStroops).toBeNull();
  });

  it('estimates a larger bump cost for a larger entry', async () => {
    const fetcher = fakeFetcher([
      { xdr: xdrOfSize(4_000), liveUntilLedgerSeq: 1_100_000 },
    ]);

    const report = await analyzeContractStorage(
      {
        contractId: CONTRACT_ID,
        rpcUrl: 'https://example.invalid',
        bumpLedgers: 100_000,
        warnThresholdLedgers: 10_000,
      },
      fetcher
    );

    expect(BigInt(report.entries[0].estimatedBumpCostStroops!)).toBeGreaterThan(1_000n);
  });
});

// ---------------------------------------------------------------------------
// formatReport
// ---------------------------------------------------------------------------

describe('formatReport', () => {
  it('includes contract id, ledger info, and a warning summary line', async () => {
    const fetcher: LedgerEntriesFetcher = async () => ({
      latestLedger: 1_000_000,
      entries: [{ xdr: xdrOfSize(64), liveUntilLedgerSeq: 1_005_000 }],
    });

    const report = await analyzeContractStorage(
      {
        contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAITA4',
        rpcUrl: 'https://example.invalid',
        bumpLedgers: 100_000,
        warnThresholdLedgers: 10_000,
      },
      fetcher
    );

    const output = formatReport(report);
    expect(output).toContain('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAITA4');
    expect(output).toContain('Current ledger: 1000000');
    expect(output).toMatch(/NEAR EXPIRATION/);
    expect(output).toContain('within 10000 ledgers of expiration');
  });
});
