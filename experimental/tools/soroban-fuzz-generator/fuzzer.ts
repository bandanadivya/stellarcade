/**
 * Fuzzing runner for Soroban contract invocations.
 *
 * Core design: the actual "run this against a contract" step is
 * dependency-injected as a `SimulateFn`, so the runner, the panic
 * detector, and the reproducible-seed mechanism are all fully unit
 * testable without any network access. Real usage wires `SimulateFn` to
 * an actual Soroban RPC `simulateTransaction` call (or `soroban-cli
 * contract invoke --sim-only`-equivalent); tests inject a fake/mock.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { FuzzInput, generateAllEdgeCases } from './generators';

// ---------------------------------------------------------------------------
// Reproducible seed mechanism (deterministic PRNG)
// ---------------------------------------------------------------------------

/** A small, dependency-free, deterministic PRNG (mulberry32). Given the
 * same numeric seed, `next()` always produces the same sequence of
 * floats in `[0, 1)`, which is what makes a fuzzing run reproducible: log
 * the seed, and a later run with `--seed <same value>` regenerates the
 * exact same input order/selection. Not cryptographically secure — that
 * property is irrelevant here, only determinism matters. */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministically shuffle `items` using a seeded RNG (Fisher-Yates).
 * Given the same `seed`, always produces the same output order. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const rng = createSeededRng(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Simulation + panic detection
// ---------------------------------------------------------------------------

/** Result of simulating one contract invocation. Shaped loosely on what a
 * Soroban RPC `simulateTransaction` response conveys: either it
 * succeeded (with some return value), or it failed with an error that
 * may or may not indicate an unhandled host panic (as opposed to a
 * contract returning a well-formed `Err` via its own `Result` type). */
export interface SimulationResult {
  success: boolean;
  /** Present when `success` is true. */
  returnValue?: unknown;
  /** Present when `success` is false: the raw error message/diagnostic
   * text from the simulation. */
  error?: string;
}

/** Dependency-injected simulation function. Real usage wires this to a
 * Soroban RPC `simulateTransaction` call against `--contract`/`--method`;
 * tests inject a fake that returns canned `SimulationResult`s or throws. */
export type SimulateFn = (input: FuzzInput) => Promise<SimulationResult> | SimulationResult;

export type PanicClassification = 'handled' | 'panic' | 'ok';

export interface ClassifiedResult {
  input: FuzzInput;
  classification: PanicClassification;
  /** The raw error/thrown message, if any. */
  detail?: string;
}

/**
 * Panic detector: distinguishes a contract that handled bad input
 * gracefully from one that hit an unhandled host exception/panic.
 *
 * Heuristic (documented, since "panic" isn't a single well-typed field on
 * a real simulateTransaction response):
 * - A thrown JS error, or a `SimulationResult` with `success: false` whose
 *   `error` text matches known host-panic signatures (unreachable,
 *   trapped, panicked, out of gas/budget exceeded, host object/WASM VM
 *   errors) is classified `'panic'`.
 * - A `SimulationResult` with `success: false` whose error text instead
 *   looks like a well-formed contract error (e.g. a `HostError` wrapping
 *   a contract's own `Result::Err`/`#[contracterror]` code, matched via
 *   the `Error(Contract` / `ContractError` signature Soroban emits for
 *   those) is classified `'handled'` — the contract validated its input
 *   and rejected it on purpose, which is the desired behavior for
 *   malformed/edge-case input.
 * - A `SimulationResult` with `success: true` is classified `'ok'`.
 */
const PANIC_SIGNATURES = [
  /panicked at/i,
  /unreachable/i,
  /wasm trap/i,
  /VM call trapped/i,
  /host budget/i,
  /budget exceeded/i,
  /out of gas/i,
  /UnexpectedError/i,
  /InternalError/i,
  /stack overflow/i,
];

const HANDLED_ERROR_SIGNATURES = [
  /Error\(Contract/i,
  /ContractError/i,
  /HostError:.*Error\(Contract/i,
];

export function classifySimulationOutcome(
  result: SimulationResult | null,
  thrownError: unknown
): { classification: PanicClassification; detail?: string } {
  if (thrownError !== null && thrownError !== undefined) {
    const message = thrownError instanceof Error ? thrownError.message : String(thrownError);
    return { classification: 'panic', detail: message };
  }

  if (!result) {
    return { classification: 'panic', detail: 'no simulation result and no thrown error' };
  }

  if (result.success) {
    return { classification: 'ok' };
  }

  const errorText = result.error ?? '';

  if (HANDLED_ERROR_SIGNATURES.some((re) => re.test(errorText))) {
    return { classification: 'handled', detail: errorText };
  }

  if (PANIC_SIGNATURES.some((re) => re.test(errorText))) {
    return { classification: 'panic', detail: errorText };
  }

  // Default for an unrecognized failure shape: treat conservatively as a
  // panic candidate so it surfaces for human review rather than being
  // silently classified as "fine".
  return { classification: 'panic', detail: errorText || 'unrecognized failure' };
}

// ---------------------------------------------------------------------------
// Fuzzing runner
// ---------------------------------------------------------------------------

export interface FuzzRunOptions {
  /** Number of iterations to run. If more than the number of available
   * edge cases, inputs are cycled (with reseeded shuffling per lap) so a
   * requested iteration count is always honored. */
  iterations: number;
  /** Seed for the reproducible PRNG driving input ordering. Logged in the
   * result so a run can be exactly reproduced later. */
  seed?: number;
  /** Override the default edge-case corpus (mainly for testing). */
  inputs?: FuzzInput[];
}

export interface FuzzRunResult {
  seed: number;
  iterations: number;
  results: ClassifiedResult[];
  panics: ClassifiedResult[];
  handled: ClassifiedResult[];
  ok: ClassifiedResult[];
}

/** Run `simulate` against a corpus of generated edge-case inputs for
 * `iterations` runs, classifying each result as ok/handled/panic. The
 * input order is deterministic given `seed` (defaults to a
 * timestamp-derived seed, always echoed back in the result so the exact
 * run can be reproduced by passing that seed back in). */
export async function runFuzz(
  simulate: SimulateFn,
  options: FuzzRunOptions
): Promise<FuzzRunResult> {
  const seed = options.seed ?? Date.now() >>> 0;
  const corpus = options.inputs ?? generateAllEdgeCases();
  if (corpus.length === 0) {
    throw new Error('Fuzz input corpus is empty');
  }

  const shuffled = seededShuffle(corpus, seed);
  const results: ClassifiedResult[] = [];

  for (let i = 0; i < options.iterations; i += 1) {
    const input = shuffled[i % shuffled.length];

    let simResult: SimulationResult | null = null;
    let thrown: unknown = null;
    try {
      simResult = await simulate(input);
    } catch (err) {
      thrown = err;
    }

    const { classification, detail } = classifySimulationOutcome(simResult, thrown);
    results.push({ input, classification, detail });
  }

  return {
    seed,
    iterations: options.iterations,
    results,
    panics: results.filter((r) => r.classification === 'panic'),
    handled: results.filter((r) => r.classification === 'handled'),
    ok: results.filter((r) => r.classification === 'ok'),
  };
}

// ---------------------------------------------------------------------------
// Test-fixture generator: write failing inputs as Rust unit test snippets
// ---------------------------------------------------------------------------

/** Render a `FuzzInput`'s value as a Rust literal, for embedding into a
 * generated `#[test]` snippet. Best-effort: covers the value shapes this
 * tool's own generators produce (integers/bigints, strings, arrays). */
function toRustLiteral(value: unknown): string {
  if (typeof value === 'bigint') return `${value.toString()}i128`;
  if (typeof value === 'number') return Number.isInteger(value) ? `${value}` : `${value}f64`;
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `vec![${value.map(toRustLiteral).join(', ')}]`;
  return JSON.stringify(value);
}

function sanitizeIdentifier(label: string): string {
  return label.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

/** Generate a Rust `#[test]` snippet (as a string template) reproducing
 * one failing fuzz input, for a human to paste into a contract's test
 * suite as a regression test. This only emits a template — it never
 * writes to or otherwise touches any contract source file. */
export function renderRustTestSnippet(
  result: ClassifiedResult,
  contractId: string,
  method: string
): string {
  const testName = `fuzz_regression_${sanitizeIdentifier(result.input.case.label)}`;
  const literal = toRustLiteral(result.input.case.value);

  return `// Auto-generated by soroban-fuzz-generator.
// Contract: ${contractId}
// Method: ${method}
// Input kind: ${result.input.type} (${result.input.case.label})
// Classification: ${result.classification}
${result.detail ? `// Detail: ${result.detail.replace(/\n/g, ' ').slice(0, 200)}\n` : ''}#[test]
fn ${testName}() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(${'/* YourContract */'}, ());
    let client = ${'/* YourContractClient */'}::new(&env, &contract_id);

    // Reproduces a "${result.classification}" outcome discovered by
    // soroban-fuzz-generator against method \`${method}\`.
    let input = ${literal};
    let result = client.try_${method}(&input);

    // TODO: assert the expected outcome once triaged, e.g.:
    // assert!(result.is_err());
    let _ = result;
}
`;
}

/**
 * Write out one Rust test snippet file per failing (panic-classified)
 * result into `outDir`, creating it if necessary. Returns the list of
 * file paths written. Pure filesystem I/O — never touches contract
 * source files, only writes new standalone snippet files into `outDir`.
 */
export function writeFailingTestFixtures(
  results: ClassifiedResult[],
  outDir: string,
  contractId: string,
  method: string
): string[] {
  const failing = results.filter((r) => r.classification === 'panic');
  if (failing.length === 0) return [];

  fs.mkdirSync(outDir, { recursive: true });

  const written: string[] = [];
  failing.forEach((result, index) => {
    const fileName = `fuzz_${sanitizeIdentifier(result.input.case.label)}_${index}.rs`;
    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, renderRustTestSnippet(result, contractId, method));
    written.push(filePath);
  });

  return written;
}

export type { FuzzInput } from './generators';
