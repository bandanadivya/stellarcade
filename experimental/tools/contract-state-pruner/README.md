# contract-state-pruner

A read-only CLI for auditing how close a Soroban contract's storage
entries are to TTL (time-to-live) expiration, and estimating what it
would cost to extend them.

> **Status:** experimental, self-contained tool under `experimental/tools/`.
> It does not modify or depend on any core repo tooling.

## This tool never mutates on-chain state

`contract-state-pruner` only calls Soroban RPC's `getLedgerEntries` (via
`@stellar/stellar-sdk`'s `rpc.Server`) to read TTL/expiration metadata. It
never submits a transaction, never calls `extendFootprintTtl`, and never
writes to the ledger. It is purely diagnostic: it tells you what's close
to expiring and what a bump would cost, so you can decide whether (and
how) to extend it yourself.

## What it inspects

Soroban RPC has no "list every storage key for this contract" method —
`getLedgerEntries` requires the caller to already know which `LedgerKey`s
to fetch. Given that, this tool always inspects a contract's **instance**
storage entry (directly addressable without knowing its internal keys),
plus whatever **persistent** (`--keys`) or **temporary** (`--temp-keys`)
Symbol-keyed storage keys you explicitly supply. In practice, you get
those key names from the contract's own source (its `DataKey` enum's
Symbol variants) or from a previous observation/snapshot (see the sibling
`contract-state-snapshot` tool).

For each entry, the report distinguishes:

- **Instance** — the contract's always-present instance storage entry.
- **Persistent** — long-lived application data (balances, config, etc).
- **Temporary** — short-lived data the network is free to evict once its
  TTL lapses (no way to restore it afterward).

## TTL math

For each present entry, ledgers remaining until expiration is:

```
ledgersRemaining = liveUntilLedgerSeq - currentLedger
```

Any entry with `ledgersRemaining <= --warn-threshold` (default `10000`) is
flagged in the output as **NEAR EXPIRATION**. A negative or zero value
means the entry has already expired.

## Fee estimation formula (read this before trusting a number)

Soroban charges "rent" to keep a storage entry alive: extending an
entry's TTL costs a resource fee proportional to **entry size in bytes**
and **the number of ledgers the TTL is extended by**, plus a small flat
per-operation overhead — mirroring the shape of the real
`ExtendFootprintTTL` resource-fee formula used by
`simulateTransaction`/preflight:

```
estimatedBumpCostStroops = ceil(
  entrySizeBytes * bumpLedgers * stroopsPerByteLedger + baseFeeStroops
)
```

The constants (`stroopsPerByteLedger = 0.01`, `baseFeeStroops = 100`, see
`DEFAULT_RENT_FEE_MODEL` in `storageAnalyzer.ts`) are a **reasonable
approximation** of the write-fee-per-ledger component of Soroban's rent
model, not the live network's fee schedule. The actual rate is a network
configuration setting (rent/write-fee config under Soroban's
`ConfigSettingContractLedgerCost`) that can and does change via network
upgrade. **Treat every `estimatedBumpCostStroops` value as directional
only** — before submitting a real TTL-extension transaction, confirm the
actual cost with a real `simulateTransaction`/`extendFootprintTtl`
preflight against the target network.

## Installation

```bash
cd experimental/tools/contract-state-pruner
npm install
```

## CLI usage

```
contract-state-pruner --contract <id> [--rpc-url <url>] [--bump-ledgers <num>] [--warn-threshold <num>] [--keys <symbols>] [--temp-keys <symbols>] [--out <file>] [--json]
```

Flags:

| Flag | Required | Description |
|---|---|---|
| `--contract <id>` | yes | The contract's `C...` strkey |
| `--rpc-url <url>` | no | Soroban RPC endpoint (default `https://soroban-testnet.stellar.org`) |
| `--bump-ledgers <num>` | no | Ledger count to estimate a TTL-extension cost for (default `100000`) |
| `--warn-threshold <num>` | no | Flag entries at or below this many ledgers remaining (default `10000`) |
| `--keys <symbols>` | no | Comma-separated persistent storage key Symbols to inspect |
| `--temp-keys <symbols>` | no | Comma-separated temporary storage key Symbols to inspect |
| `--out <file>` | no | Write the report as JSON to this file instead of printing a table |
| `--json` | no | Print the raw JSON report to stdout instead of a formatted table |

By default the CLI prints a terminal table; pass `--out report.json` to
write the same data as a JSON file instead (useful for CI gating or
diffing over time), or `--json` to print JSON to stdout.

The process exits with code `1` if any entry is flagged as near
expiration, `0` otherwise, so it can be used as a CI gate.

### Example

```bash
npx ts-node cli.ts \
  --contract CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAITA4 \
  --rpc-url https://soroban-testnet.stellar.org \
  --keys BALANCE,ADMIN \
  --bump-ledgers 500000 \
  --warn-threshold 20000
```

## Library usage

```ts
import { analyzeContractStorage, formatReport } from '@stellarcade/contract-state-pruner';

const report = await analyzeContractStorage({
  contractId: 'C...',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  bumpLedgers: 100_000,
  warnThresholdLedgers: 10_000,
  persistentKeys: ['BALANCE'],
});

console.log(formatReport(report));
```

`analyzeContractStorage`'s second argument is an injectable
`LedgerEntriesFetcher`, which is how the test suite substitutes a fake
response instead of making real RPC calls — the core TTL/fee-estimation
logic is fully unit-testable without network access. Real usage wires it
automatically to `@stellar/stellar-sdk`'s `rpc.Server` when no fetcher is
supplied.

## Testing

```bash
npm test
```

Covers TTL-remaining arithmetic (including already-expired and
exactly-at-threshold boundary cases), near-expiration flagging, the
bump-cost formula's internal consistency (doubling `bumpLedgers` or entry
size roughly doubles the variable portion of the cost), missing-entry
handling, and report formatting.
