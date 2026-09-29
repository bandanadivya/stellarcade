# soroban-fuzz-generator

A fuzzing utility that generates edge-case, ScVal-shaped test inputs
(integers, strings, vectors) for a Soroban contract method, runs them
through a pluggable "simulate" function, and classifies each result as
gracefully handled or an unhandled host panic.

> **Status:** experimental, self-contained tool under `experimental/tools/`.
> It does not modify or depend on any core repo tooling, and it **never
> touches** `experimental/contracts/*` or `contracts/*` source — it only
> generates test inputs and, optionally, standalone Rust test-snippet
> fixture files in an output directory you choose.

## Core design: no network required

The generator and panic-classifier logic is fully unit-testable without
any live Soroban RPC connection. The fuzzing runner (`runFuzz` in
`fuzzer.ts`) takes a dependency-injected `SimulateFn`:

```ts
export type SimulateFn = (input: FuzzInput) => Promise<SimulationResult> | SimulationResult;
```

Tests inject a fake/mock `SimulateFn` that returns canned results or
throws. Real usage wires `SimulateFn` to an actual Soroban RPC
`simulateTransaction` call. The CLI's default mode (no `--live` flag) uses
a no-op simulator that always reports success, so the tool is runnable
out of the box to exercise the generation/classification pipeline;
`--live` is an optional, secondary path (see below) — the tool's value
doesn't depend on it.

## What it generates (`generators.ts`)

- **Integers** — boundary values per numeric kind:
  - `u32`: `0`, `1`, `u32::MAX` (2^32 - 1)
  - `i32`: `0`, `1`, `-1`, `i32::MIN`, `i32::MAX`
  - `u64` / `i64`: same shape as above, represented as `bigint` (JS
    `number` loses precision above 2^53)
  - `u128` / `i128`: same shape, as `bigint` (Soroban's 128-bit integers
    vastly exceed `Number.MAX_SAFE_INTEGER`); `i128::MIN`/`MAX` are the
    real Soroban i128 bounds
  - u256/i256 aren't generated yet; add them the same way if needed.
- **Strings** — empty string, single character, a 10KB string, a
  multi-byte/emoji string, whitespace-only.
- **Vectors** — empty vector, single-element vector, a large (1,000
  element) flat vector, and vectors nested 50 and 100 levels deep (a
  common source of stack-depth/recursion issues).

These are plain JS values (numbers/bigints/strings/arrays), not real
`xdr.ScVal` objects — converting a generated value into the `ScVal` shape
appropriate to a specific contract method's real parameter type (e.g. via
`@stellar/stellar-sdk`'s `nativeToScVal`) is the caller's job, since this
tool has no knowledge of any particular contract's ABI/spec.

## Fuzzing runner (`fuzzer.ts`)

- `runFuzz(simulate, { iterations, seed, inputs })` — runs `simulate`
  against the edge-case corpus (or a custom `inputs` array) for
  `iterations` runs, cycling through the corpus if `iterations` exceeds
  its size. Every result is classified `ok` / `handled` / `panic`.
- **Reproducible seed** — `createSeededRng(seed)` is a small,
  dependency-free deterministic PRNG (mulberry32). The same `seed` always
  produces the same input ordering (`seededShuffle`), so a fuzzing run's
  seed can be logged and passed back via `--seed` to exactly reproduce it.
- **Panic detector** (`classifySimulationOutcome`) — distinguishes:
  - `'ok'`: simulation succeeded.
  - `'handled'`: simulation failed, but the error text matches a
    well-formed contract error signature (e.g. `Error(Contract, #N)`,
    `ContractError`) — the contract validated the input and rejected it
    on purpose.
  - `'panic'`: simulation threw, or its error text matches a host-panic
    signature (`unreachable`, `wasm trap`, `panicked at`, budget/gas
    exceeded, internal/unexpected host errors), or the failure shape isn't
    recognized at all (treated conservatively as a panic candidate so it
    surfaces for human review).
- **Test-fixture generator** — `writeFailingTestFixtures(results, outDir,
  contractId, method)` writes one Rust `#[test]` snippet (string
  template, via `renderRustTestSnippet`) per panic-classified result into
  `outDir`, for a human to paste into a contract's own test suite as a
  regression test. This only writes new files into the directory you
  choose; it never modifies any existing file, and never touches
  `experimental/contracts/*` or `contracts/*`.

## CLI usage

```
soroban-fuzz-generator --contract <id> --method <name> [--iterations <num>] [--seed <num>] [--out-tests <dir>] [--live --rpc-url <url>]
```

Flags:

| Flag | Required | Description |
|---|---|---|
| `--contract <id>` | yes | Contract's `C...` strkey |
| `--method <name>` | yes | Contract method name to fuzz |
| `--iterations <num>` | no | Number of fuzz iterations (default `100`) |
| `--seed <num>` | no | Reproducible PRNG seed (default: a fresh timestamp-derived seed, echoed in the output) |
| `--out-tests <dir>` | no | Directory to write failing-input Rust test snippets to (default `./fuzz-fixtures`) |
| `--live` | no | Attempt a real RPC `simulateTransaction` call per input (see "Live mode" below) |
| `--rpc-url <url>` | only with `--live` | Soroban RPC endpoint URL |

Exit code is `1` if any input was classified as a panic, `0` otherwise —
usable as a CI gate.

### Example

```bash
npx ts-node cli.ts --contract CCONTRACT... --method deposit --iterations 200 --seed 12345
```

## Live mode

`--live` is an optional integration point for wiring real network
simulation; by design it is **not** required for this tool to be useful
or tested. The current `makeLiveSimulator` in `cli.ts` documents where a
real caller would build a signed `InvokeHostFunction` transaction
envelope for `--contract`/`--method` (converting each generated value to
an `ScVal` for the target method's actual parameter types) and call
`@stellar/stellar-sdk`'s `rpc.Server#simulateTransaction`. If you need
this today, use the library API directly and pass your own `SimulateFn`
to `runFuzz` — that's the same seam the test suite uses.

## Testing

```bash
npm test
```

Covers: integer generator boundary values (0, 1, kind-specific MAX,
including `bigint` correctness for 64/128-bit kinds); string edge cases;
vector edge cases (empty, large, 50+ and 100+ level nesting); the seeded
PRNG's determinism and shuffle-permutation correctness; the panic
detector's classification of thrown errors, host-trap-shaped error text,
well-formed contract errors, and successful results; `runFuzz`'s
iteration count, reproducibility given a fixed seed, corpus cycling, and
preservation of the offending input payload on a panic; and the Rust
test-fixture writer (one file per panic, none when there are no panics).
