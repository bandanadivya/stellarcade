import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  generateAllEdgeCases,
  generateIntegerEdgeCases,
  generateStringEdgeCases,
  generateVectorEdgeCases,
  I32_MAX,
  U32_MAX,
  I128_MAX,
} from './generators';
import {
  classifySimulationOutcome,
  createSeededRng,
  renderRustTestSnippet,
  runFuzz,
  seededShuffle,
  writeFailingTestFixtures,
  type ClassifiedResult,
  type SimulateFn,
} from './fuzzer';

// ---------------------------------------------------------------------------
// 1. integer generator emits boundary values (0, 1, and a MAX_INT-equivalent)
// ---------------------------------------------------------------------------

describe('generateIntegerEdgeCases', () => {
  it('u32 includes 0, 1, and U32_MAX', () => {
    const values = generateIntegerEdgeCases('u32').map((c) => c.value);
    expect(values).toContain(0);
    expect(values).toContain(1);
    expect(values).toContain(U32_MAX);
  });

  it('i32 includes 0, 1, -1, and the i32 max', () => {
    const values = generateIntegerEdgeCases('i32').map((c) => c.value);
    expect(values).toContain(0);
    expect(values).toContain(1);
    expect(values).toContain(-1);
    expect(values).toContain(I32_MAX);
  });

  it('i128 includes 0, 1, and the i128 max as a bigint', () => {
    const values = generateIntegerEdgeCases('i128').map((c) => c.value);
    expect(values).toContain(0n);
    expect(values).toContain(1n);
    expect(values).toContain(I128_MAX);
    expect(typeof values.find((v) => v === I128_MAX)).toBe('bigint');
  });

  it('every generated edge case is uniquely labeled within its kind', () => {
    for (const kind of ['u32', 'i32', 'u64', 'i64', 'u128', 'i128'] as const) {
      const labels = generateIntegerEdgeCases(kind).map((c) => c.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. vector generator produces both empty and large/deeply-nested vectors
// ---------------------------------------------------------------------------

describe('generateVectorEdgeCases', () => {
  const cases = generateVectorEdgeCases();

  it('includes an empty vector', () => {
    const empty = cases.find((c) => c.label === 'empty_vector');
    expect(empty).toBeDefined();
    expect(empty!.value).toEqual([]);
  });

  it('includes a large flat vector', () => {
    const large = cases.find((c) => c.label === 'large_flat_vector');
    expect(large).toBeDefined();
    expect(large!.value.length).toBeGreaterThanOrEqual(1_000);
  });

  it('includes a vector nested 50+ levels deep', () => {
    const deep = cases.find((c) => c.label === 'deeply_nested_vector_50');
    expect(deep).toBeDefined();

    let depth = 0;
    let cursor: unknown = deep!.value;
    while (Array.isArray(cursor)) {
      depth += 1;
      cursor = cursor[0];
    }
    expect(depth).toBeGreaterThanOrEqual(50);
  });
});

describe('generateStringEdgeCases', () => {
  it('includes an empty string and a 10KB string', () => {
    const cases = generateStringEdgeCases();
    const empty = cases.find((c) => c.label === 'empty_string');
    const large = cases.find((c) => c.label === 'ten_kb_string');
    expect(empty!.value).toBe('');
    expect(Buffer.byteLength(large!.value, 'utf8')).toBeGreaterThanOrEqual(10 * 1024);
  });
});

describe('generateAllEdgeCases', () => {
  it('aggregates integer, string, and vector cases', () => {
    const all = generateAllEdgeCases();
    expect(all.some((c) => c.type === 'integer')).toBe(true);
    expect(all.some((c) => c.type === 'string')).toBe(true);
    expect(all.some((c) => c.type === 'vector')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Reproducible seed mechanism
// ---------------------------------------------------------------------------

describe('createSeededRng / seededShuffle', () => {
  it('produces identical sequences for the same seed', () => {
    const rngA = createSeededRng(42);
    const rngB = createSeededRng(42);
    const seqA = Array.from({ length: 5 }, () => rngA());
    const seqB = Array.from({ length: 5 }, () => rngB());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds (overwhelmingly likely)', () => {
    const rngA = createSeededRng(1);
    const rngB = createSeededRng(2);
    expect(rngA()).not.toBe(rngB());
  });

  it('seededShuffle is deterministic given the same seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(seededShuffle(items, 7)).toEqual(seededShuffle(items, 7));
  });

  it('seededShuffle preserves the same elements (a permutation, not a mutation)', () => {
    const items = [1, 2, 3, 4, 5];
    const shuffled = seededShuffle(items, 99);
    expect([...shuffled].sort()).toEqual([...items].sort());
  });
});

// ---------------------------------------------------------------------------
// 3. panic detector correctly classifies a mock simulation error result
//    as a caught panic and logs the offending input payload
// ---------------------------------------------------------------------------

describe('classifySimulationOutcome', () => {
  it('classifies a thrown error as a panic', () => {
    const { classification, detail } = classifySimulationOutcome(null, new Error('unreachable executed'));
    expect(classification).toBe('panic');
    expect(detail).toContain('unreachable');
  });

  it('classifies a host-trap-shaped error result as a panic', () => {
    const { classification } = classifySimulationOutcome(
      { success: false, error: 'HostError: VM call trapped: UnreachableCodeReached' },
      null
    );
    expect(classification).toBe('panic');
  });

  it('classifies a well-formed contract error result as handled', () => {
    const { classification } = classifySimulationOutcome(
      { success: false, error: 'HostError: Error(Contract, #3)' },
      null
    );
    expect(classification).toBe('handled');
  });

  it('classifies a successful simulation as ok', () => {
    const { classification } = classifySimulationOutcome({ success: true, returnValue: 42 }, null);
    expect(classification).toBe('ok');
  });

  it('classifies budget-exceeded errors as a panic', () => {
    const { classification } = classifySimulationOutcome(
      { success: false, error: 'Error: budget exceeded' },
      null
    );
    expect(classification).toBe('panic');
  });
});

// ---------------------------------------------------------------------------
// runFuzz: end-to-end with an injected (mocked) simulate function
// ---------------------------------------------------------------------------

describe('runFuzz', () => {
  it('runs the requested number of iterations and classifies each result', async () => {
    const simulate: SimulateFn = vi.fn(() => ({ success: true }));
    const result = await runFuzz(simulate, { iterations: 10, seed: 1 });

    expect(result.iterations).toBe(10);
    expect(result.results).toHaveLength(10);
    expect(result.ok).toHaveLength(10);
    expect(simulate).toHaveBeenCalledTimes(10);
  });

  it('is reproducible: the same seed produces the same input sequence', async () => {
    const seenA: string[] = [];
    const seenB: string[] = [];
    const simulateA: SimulateFn = (input) => {
      seenA.push(input.case.label);
      return { success: true };
    };
    const simulateB: SimulateFn = (input) => {
      seenB.push(input.case.label);
      return { success: true };
    };

    await runFuzz(simulateA, { iterations: 15, seed: 555 });
    await runFuzz(simulateB, { iterations: 15, seed: 555 });

    expect(seenA).toEqual(seenB);
  });

  it('classifies a mock simulation error result as a caught panic and preserves the offending input', async () => {
    const simulate: SimulateFn = (input) => {
      if (input.case.label === 'empty_vector') {
        return { success: false, error: 'wasm trap: unreachable' };
      }
      return { success: true };
    };

    const result = await runFuzz(simulate, {
      iterations: 3,
      seed: 2,
      inputs: [
        { type: 'vector', case: { label: 'empty_vector', value: [] } },
        { type: 'integer', case: { kind: 'u32', label: 'zero', value: 0 } },
      ],
    });

    expect(result.panics.length).toBeGreaterThan(0);
    const panic = result.panics.find((p) => p.input.case.label === 'empty_vector');
    expect(panic).toBeDefined();
    expect(panic!.detail).toContain('unreachable');
    expect(panic!.input.case.value).toEqual([]);
  });

  it('classifies a thrown exception from simulate as a panic', async () => {
    const simulate: SimulateFn = () => {
      throw new Error('panicked at src/lib.rs:42');
    };

    const result = await runFuzz(simulate, { iterations: 2, seed: 3 });
    expect(result.panics).toHaveLength(2);
  });

  it('throws if the input corpus is empty', async () => {
    const simulate: SimulateFn = () => ({ success: true });
    await expect(runFuzz(simulate, { iterations: 1, inputs: [] })).rejects.toThrow(/empty/i);
  });

  it('cycles through the corpus when iterations exceeds corpus size', async () => {
    const simulate: SimulateFn = () => ({ success: true });
    const result = await runFuzz(simulate, {
      iterations: 5,
      seed: 9,
      inputs: [{ type: 'integer', case: { kind: 'u32', label: 'zero', value: 0 } }],
    });
    expect(result.results).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Test-fixture generator
// ---------------------------------------------------------------------------

describe('renderRustTestSnippet', () => {
  it('renders a #[test] function containing the input value and classification', () => {
    const result: ClassifiedResult = {
      input: { type: 'integer', case: { kind: 'i128', label: 'i128_min', value: -1n } },
      classification: 'panic',
      detail: 'wasm trap: unreachable',
    };

    const snippet = renderRustTestSnippet(result, 'CCONTRACT', 'transfer');
    expect(snippet).toContain('#[test]');
    expect(snippet).toContain('fn fuzz_regression_i128_min');
    expect(snippet).toContain('-1i128');
    expect(snippet).toContain('CCONTRACT');
    expect(snippet).toContain('transfer');
  });
});

describe('writeFailingTestFixtures', () => {
  it('writes one .rs file per panic-classified result to the output directory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuzz-fixtures-'));
    const results: ClassifiedResult[] = [
      {
        input: { type: 'string', case: { label: 'empty_string', value: '' } },
        classification: 'panic',
        detail: 'unreachable',
      },
      {
        input: { type: 'integer', case: { kind: 'u32', label: 'zero', value: 0 } },
        classification: 'ok',
      },
    ];

    const written = writeFailingTestFixtures(results, tempDir, 'CCONTRACT', 'deposit');
    expect(written).toHaveLength(1);
    expect(fs.existsSync(written[0])).toBe(true);
    expect(fs.readFileSync(written[0], 'utf8')).toContain('#[test]');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes nothing when there are no panics', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuzz-fixtures-'));
    const results: ClassifiedResult[] = [
      { input: { type: 'integer', case: { kind: 'u32', label: 'zero', value: 0 } }, classification: 'ok' },
    ];

    const written = writeFailingTestFixtures(results, tempDir, 'CCONTRACT', 'deposit');
    expect(written).toHaveLength(0);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
