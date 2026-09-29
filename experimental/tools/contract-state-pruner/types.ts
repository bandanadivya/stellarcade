/**
 * Shared types for the Soroban contract state pruner CLI.
 *
 * This tool is strictly READ-ONLY: it never submits a transaction and
 * never mutates on-chain state. It only queries `getLedgerEntries` (via
 * `@stellar/stellar-sdk`'s RPC client) to report which storage entries are
 * close to TTL expiration, and estimates what it would cost to bump them.
 */

export type StorageEntryType = 'instance' | 'persistent' | 'temporary';

/** One ledger key to inspect, alongside a human-readable label for
 * reporting (the CLI always includes the contract's instance entry, plus
 * any persistent/temporary keys explicitly supplied). */
export interface StorageKeyDescriptor {
  type: StorageEntryType;
  /** Human-readable label for this key (e.g. `<instance>` or a Symbol
   * name), used only for display. */
  label: string;
}

/** A single storage entry's TTL/expiration status, as reported to the
 * user. */
export interface StorageEntryReport {
  type: StorageEntryType;
  label: string;
  /** True if the RPC reports this entry as present on the ledger. */
  present: boolean;
  /** The ledger sequence at which this entry's TTL expires (becomes
   * archived), if present. `null` for temporary entries the RPC reports
   * as already expired/evicted, or for missing entries. */
  liveUntilLedgerSeq: number | null;
  /** `liveUntilLedgerSeq - currentLedger`. Negative or zero means the
   * entry has already expired. `null` when `liveUntilLedgerSeq` is
   * unknown. */
  ledgersRemaining: number | null;
  /** True when `ledgersRemaining` is non-null and at or below the
   * configured warn threshold. */
  nearExpiration: boolean;
  /** Estimated stroops cost to extend this entry's TTL by the CLI's
   * configured `--bump-ledgers` count. `null` if the entry's size
   * couldn't be determined (e.g. it's missing). */
  estimatedBumpCostStroops: string | null;
}

export interface PrunerReport {
  contractId: string;
  rpcUrl: string;
  currentLedger: number;
  warnThresholdLedgers: number;
  bumpLedgers: number;
  entries: StorageEntryReport[];
  generatedAt: string;
}

/** Minimal shape of a `getLedgerEntries` RPC response entry, as returned
 * by `@stellar/stellar-sdk`'s `rpc.Server.getLedgerEntries` (or an
 * injected fake for testing). Kept intentionally narrow so tests can
 * construct fixtures without depending on the full SDK response shape. */
export interface RawLedgerEntry {
  /** Base64 XDR of the `LedgerEntryData` (used to measure entry size for
   * the fee estimate). */
  xdr: string;
  liveUntilLedgerSeq?: number;
}

export interface GetLedgerEntriesResult {
  latestLedger: number;
  entries: RawLedgerEntry[];
}

/** Dependency-injected fetcher, so the analyzer logic can be unit tested
 * without a live Soroban RPC endpoint. Real usage wires this to
 * `@stellar/stellar-sdk`'s `rpc.Server`. */
export type LedgerEntriesFetcher = (
  keys: StorageKeyDescriptor[]
) => Promise<GetLedgerEntriesResult>;

export interface AnalyzeOptions {
  contractId: string;
  rpcUrl: string;
  bumpLedgers: number;
  warnThresholdLedgers: number;
}

/**
 * Fee-estimation constants for the rent-bump formula documented in
 * `storageAnalyzer.ts` and the README. These are approximations of the
 * Soroban resource-fee schedule's write-fee-per-ledger component, NOT the
 * live network fee schedule (which can and does change via network
 * upgrades). Treat estimates as directional only.
 */
export interface RentFeeModel {
  /** Estimated stroops charged per byte of entry size, per ledger the TTL
   * is extended. */
  stroopsPerByteLedger: number;
  /** Flat per-entry stroops overhead applied to any TTL-extension
   * operation, independent of size (approximates base tx/op fees). */
  baseFeeStroops: number;
}
