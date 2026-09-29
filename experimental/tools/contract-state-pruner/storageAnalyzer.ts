import { Address, rpc as sorobanRpc, xdr } from '@stellar/stellar-sdk';
import {
  AnalyzeOptions,
  GetLedgerEntriesResult,
  LedgerEntriesFetcher,
  PrunerReport,
  RawLedgerEntry,
  RentFeeModel,
  StorageEntryReport,
  StorageEntryType,
  StorageKeyDescriptor,
} from './types';

/**
 * Rent/TTL-bump fee model.
 *
 * Soroban charges "rent" for keeping a storage entry alive: extending an
 * entry's TTL costs a resource fee proportional to the entry's size (in
 * bytes) and the number of ledgers the TTL is extended by, plus a small
 * flat per-operation overhead. This mirrors the shape of the real
 * `ExtendFootprintTTL` resource-fee formula used by soroban-rpc's
 * `simulateTransaction`/preflight (fee = rent_rate_per_byte_per_ledger *
 * entry_size_bytes * extension_ledgers + base_fee), but the constants
 * below are a reasonable approximation, NOT the live network's fee
 * schedule — that schedule is a network configuration
 * (`ConfigSettingContractCostParamsCpuInstructions` / rent config, i.e.
 * `write_fee_1kb_per_ledger` in Soroban's `ConfigSettingId
 * .CONFIG_SETTING_CONTRACT_LEDGER_COST`) that can change via network
 * upgrade. Treat `estimatedBumpCostStroops` as directional only, and
 * always confirm with a real `simulateTransaction`/`extendFootprintTtl`
 * preflight before relying on it for a real bump transaction.
 */
export const DEFAULT_RENT_FEE_MODEL: RentFeeModel = {
  // Approximates mainnet's `write_fee_1kb_per_ledger` scaled to a
  // per-byte rate (order-of-magnitude figure as of the 2024/2025 fee
  // schedule; verify against current network config before using this to
  // budget a real transaction).
  stroopsPerByteLedger: 0.01,
  // Flat overhead approximating the base resource fee for a single
  // `ExtendFootprintTTL` operation.
  baseFeeStroops: 100,
};

/** Estimate the stroops cost of extending an entry of `entrySizeBytes` by
 * `bumpLedgers` ledgers, using `model`. Exposed separately so its
 * internal-consistency properties (e.g. "doubling bumpLedgers roughly
 * doubles cost") are directly testable. */
export function estimateBumpCostStroops(
  entrySizeBytes: number,
  bumpLedgers: number,
  model: RentFeeModel = DEFAULT_RENT_FEE_MODEL
): bigint {
  if (entrySizeBytes < 0 || bumpLedgers < 0) {
    throw new Error('entrySizeBytes and bumpLedgers must be non-negative');
  }
  const variableCost = entrySizeBytes * bumpLedgers * model.stroopsPerByteLedger;
  const total = Math.ceil(variableCost + model.baseFeeStroops);
  return BigInt(total);
}

/** `liveUntilLedgerSeq - currentLedger`. Exposed standalone for direct
 * unit testing of the TTL-remaining arithmetic. */
export function computeLedgersRemaining(
  liveUntilLedgerSeq: number | null,
  currentLedger: number
): number | null {
  if (liveUntilLedgerSeq === null) return null;
  return liveUntilLedgerSeq - currentLedger;
}

/** True when `ledgersRemaining` is known and at or below `warnThreshold`. */
export function isNearExpiration(
  ledgersRemaining: number | null,
  warnThreshold: number
): boolean {
  if (ledgersRemaining === null) return false;
  return ledgersRemaining <= warnThreshold;
}

function buildLedgerKey(
  contractId: string,
  descriptor: StorageKeyDescriptor
): xdr.LedgerKey {
  const contractAddress = new Address(contractId).toScAddress();

  if (descriptor.type === 'instance') {
    return xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: contractAddress,
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent(),
      })
    );
  }

  const key = xdr.ScVal.scvSymbol(descriptor.label);
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: contractAddress,
      key,
      durability:
        descriptor.type === 'temporary'
          ? xdr.ContractDataDurability.temporary()
          : xdr.ContractDataDurability.persistent(),
    })
  );
}

/** Byte size of a raw ledger entry, from its base64 XDR encoding. Used as
 * the size input to the rent/bump fee estimate. */
function entrySizeBytes(entry: RawLedgerEntry): number {
  return Buffer.from(entry.xdr, 'base64').length;
}

/** Build a real `@stellar/stellar-sdk` `rpc.Server`-backed fetcher for
 * `analyzeContractStorage`, bound to a specific contract. This is the
 * only place that touches the network; all analysis logic below is pure
 * and independently testable via an injected fetcher. Wired automatically
 * by `analyzeContractStorage` when no fetcher is explicitly supplied. */
export function makeRpcFetcher(rpcUrl: string, contractId: string): LedgerEntriesFetcher {
  const server = new sorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });

  return async (keys: StorageKeyDescriptor[]): Promise<GetLedgerEntriesResult> => {
    const ledgerKeys = keys.map((descriptor) => buildLedgerKey(contractId, descriptor));
    const response = await server.getLedgerEntries(...ledgerKeys);

    const entries: RawLedgerEntry[] = response.entries.map((e) => ({
      xdr: e.val.toXDR('base64'),
      liveUntilLedgerSeq: e.liveUntilLedgerSeq,
    }));

    return { latestLedger: response.latestLedger, entries };
  };
}

/**
 * Analyze a contract's instance storage entry plus any explicitly
 * supplied persistent/temporary keys: fetch each entry via
 * `getLedgerEntries`, compute ledgers remaining until TTL expiration,
 * flag entries within `warnThresholdLedgers` of expiring, and estimate
 * the stroops cost of extending each entry's TTL by `bumpLedgers`.
 *
 * `fetcher` is dependency-injected so this function is fully unit
 * testable without a live RPC endpoint; when omitted, a real
 * `@stellar/stellar-sdk` `rpc.Server`-backed fetcher is used.
 */
export async function analyzeContractStorage(
  options: AnalyzeOptions & { persistentKeys?: string[]; temporaryKeys?: string[] },
  fetcher?: LedgerEntriesFetcher,
  feeModel: RentFeeModel = DEFAULT_RENT_FEE_MODEL
): Promise<PrunerReport> {
  const resolvedFetcher =
    fetcher ?? makeRpcFetcher(options.rpcUrl, options.contractId);

  const descriptors: StorageKeyDescriptor[] = [
    { type: 'instance', label: '<instance>' },
    ...(options.persistentKeys ?? []).map(
      (label): StorageKeyDescriptor => ({ type: 'persistent', label })
    ),
    ...(options.temporaryKeys ?? []).map(
      (label): StorageKeyDescriptor => ({ type: 'temporary', label })
    ),
  ];

  const result = await resolvedFetcher(descriptors);
  const currentLedger = result.latestLedger;

  const entries: StorageEntryReport[] = descriptors.map((descriptor, index) => {
    const raw = result.entries[index] ?? null;
    const present = raw != null;
    const liveUntilLedgerSeq = raw?.liveUntilLedgerSeq ?? null;
    const ledgersRemaining = computeLedgersRemaining(liveUntilLedgerSeq, currentLedger);
    const nearExpiration = isNearExpiration(ledgersRemaining, options.warnThresholdLedgers);

    const estimatedBumpCostStroops = present
      ? estimateBumpCostStroops(entrySizeBytes(raw as RawLedgerEntry), options.bumpLedgers, feeModel).toString()
      : null;

    return {
      type: descriptor.type as StorageEntryType,
      label: descriptor.label,
      present,
      liveUntilLedgerSeq,
      ledgersRemaining,
      nearExpiration,
      estimatedBumpCostStroops,
    };
  });

  return {
    contractId: options.contractId,
    rpcUrl: options.rpcUrl,
    currentLedger,
    warnThresholdLedgers: options.warnThresholdLedgers,
    bumpLedgers: options.bumpLedgers,
    entries,
    generatedAt: new Date().toISOString(),
  };
}

/** Render a `PrunerReport` as a terminal table. */
export function formatReport(report: PrunerReport): string {
  const lines: string[] = [];
  lines.push(`Contract: ${report.contractId}`);
  lines.push(`RPC: ${report.rpcUrl}`);
  lines.push(`Current ledger: ${report.currentLedger}`);
  lines.push(`Warn threshold: ${report.warnThresholdLedgers} ledgers`);
  lines.push(`Bump size: ${report.bumpLedgers} ledgers`);
  lines.push('');
  lines.push('Type | Key | Present | Ledgers remaining | Est. bump cost (stroops) | Warning');
  lines.push('--- | --- | --- | ---: | ---: | ---');

  for (const entry of report.entries) {
    const warning = entry.nearExpiration ? 'NEAR EXPIRATION' : '';
    lines.push(
      [
        entry.type,
        entry.label,
        entry.present ? 'yes' : 'no',
        entry.ledgersRemaining ?? 'n/a',
        entry.estimatedBumpCostStroops ?? 'n/a',
        warning,
      ].join(' | ')
    );
  }

  const flagged = report.entries.filter((e) => e.nearExpiration);
  lines.push('');
  lines.push(
    flagged.length > 0
      ? `${flagged.length} entr${flagged.length === 1 ? 'y' : 'ies'} within ${report.warnThresholdLedgers} ledgers of expiration.`
      : 'No entries near expiration.'
  );

  return lines.join('\n');
}
