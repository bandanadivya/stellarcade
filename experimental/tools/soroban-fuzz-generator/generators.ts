/**
 * Edge-case value generators for fuzzing Soroban contract invocations.
 *
 * These generate plain JS values shaped like the inputs you'd pass to a
 * contract's ScVal-typed parameters (integers, strings, vectors). They do
 * NOT produce real `xdr.ScVal` objects — callers are responsible for
 * converting a generated value into an `ScVal` appropriate to the target
 * contract function's actual parameter type (e.g. via
 * `@stellar/stellar-sdk`'s `nativeToScVal`), since this tool has no
 * knowledge of a contract's real ABI/spec. Keeping generation at the
 * plain-value level keeps this module dependency-free and fully
 * unit-testable without any SDK or network dependency.
 *
 * ## Supported numeric ranges
 *
 * - **u32** boundary values: `0`, `1`, `U32_MAX` (2^32 - 1).
 * - **i32** boundary values: `0`, `1`, `-1`, `I32_MIN`, `I32_MAX`.
 * - **u64 / i64** boundary values, represented as `bigint` (JS `number`
 *   loses precision above 2^53): `0n`, `1n`, and the u64/i64 min/max.
 * - **u128 / i128** boundary values, represented as `bigint` (Soroban's
 *   128-bit integers vastly exceed `Number.MAX_SAFE_INTEGER`): `0n`,
 *   `1n`, `-1n` (i128 only), and the u128/i128 min/max.
 *
 * We do not currently generate u256/i256 edge cases; add them the same
 * way (as `bigint`) if a target contract needs them.
 */

export const U32_MAX = 4_294_967_295;
export const I32_MIN = -2_147_483_648;
export const I32_MAX = 2_147_483_647;

export const U64_MAX = 18_446_744_073_709_551_615n;
export const I64_MIN = -9_223_372_036_854_775_808n;
export const I64_MAX = 9_223_372_036_854_775_807n;

export const U128_MAX = (1n << 128n) - 1n;
export const I128_MIN = -(1n << 127n);
export const I128_MAX = (1n << 127n) - 1n;

export type IntegerKind = 'u32' | 'i32' | 'u64' | 'i64' | 'u128' | 'i128';

export interface IntegerEdgeCase {
  kind: IntegerKind;
  label: string;
  value: number | bigint;
}

/** Generate the boundary-value edge cases for a given integer kind. Every
 * kind always includes `0` and `1`; signed kinds additionally include
 * `-1` and their negative bound; all kinds include their positive max. */
export function generateIntegerEdgeCases(kind: IntegerKind): IntegerEdgeCase[] {
  switch (kind) {
    case 'u32':
      return [
        { kind, label: 'zero', value: 0 },
        { kind, label: 'one', value: 1 },
        { kind, label: 'u32_max', value: U32_MAX },
      ];
    case 'i32':
      return [
        { kind, label: 'zero', value: 0 },
        { kind, label: 'one', value: 1 },
        { kind, label: 'negative_one', value: -1 },
        { kind, label: 'i32_min', value: I32_MIN },
        { kind, label: 'i32_max', value: I32_MAX },
      ];
    case 'u64':
      return [
        { kind, label: 'zero', value: 0n },
        { kind, label: 'one', value: 1n },
        { kind, label: 'u64_max', value: U64_MAX },
      ];
    case 'i64':
      return [
        { kind, label: 'zero', value: 0n },
        { kind, label: 'one', value: 1n },
        { kind, label: 'negative_one', value: -1n },
        { kind, label: 'i64_min', value: I64_MIN },
        { kind, label: 'i64_max', value: I64_MAX },
      ];
    case 'u128':
      return [
        { kind, label: 'zero', value: 0n },
        { kind, label: 'one', value: 1n },
        { kind, label: 'u128_max', value: U128_MAX },
      ];
    case 'i128':
      return [
        { kind, label: 'zero', value: 0n },
        { kind, label: 'one', value: 1n },
        { kind, label: 'negative_one', value: -1n },
        { kind, label: 'i128_min', value: I128_MIN },
        { kind, label: 'i128_max', value: I128_MAX },
      ];
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unsupported integer kind: ${exhaustive}`);
    }
  }
}

/** Edge-case integer values across every supported kind, flattened. */
export function generateAllIntegerEdgeCases(): IntegerEdgeCase[] {
  const kinds: IntegerKind[] = ['u32', 'i32', 'u64', 'i64', 'u128', 'i128'];
  return kinds.flatMap(generateIntegerEdgeCases);
}

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------

export interface StringEdgeCase {
  label: string;
  value: string;
}

/** Edge-case strings: empty, a single character, a 10KB string, and a
 * string containing multi-byte UTF-8/emoji content (a common source of
 * byte-length-vs-character-length bugs). */
export function generateStringEdgeCases(): StringEdgeCase[] {
  return [
    { label: 'empty_string', value: '' },
    { label: 'single_char', value: 'a' },
    { label: 'ten_kb_string', value: 'x'.repeat(10 * 1024) },
    { label: 'unicode_string', value: '🚀'.repeat(256) },
    { label: 'whitespace_only', value: '   \t\n  ' },
  ];
}

// ---------------------------------------------------------------------------
// Vectors
// ---------------------------------------------------------------------------

export interface VectorEdgeCase {
  label: string;
  value: unknown[];
}

/** Build a deeply nested array `depth` levels deep, e.g. depth=3 produces
 * `[[[[]]]]`-shaped nesting with a scalar at the bottom. */
function nestedArray(depth: number, leaf: unknown = 0): unknown[] {
  let value: unknown = leaf;
  for (let i = 0; i < depth; i += 1) {
    value = [value];
  }
  return value as unknown[];
}

/** Edge-case vectors: empty, a single-element vector, a large flat
 * vector, and a deeply nested vector (50+ levels), which is a common
 * source of stack-depth/recursion panics in naive ScVal
 * serialization/deserialization or contract-side recursive logic. */
export function generateVectorEdgeCases(): VectorEdgeCase[] {
  return [
    { label: 'empty_vector', value: [] },
    { label: 'single_element_vector', value: [1] },
    { label: 'large_flat_vector', value: Array.from({ length: 1_000 }, (_, i) => i) },
    { label: 'deeply_nested_vector_50', value: nestedArray(50) },
    { label: 'deeply_nested_vector_100', value: nestedArray(100) },
  ];
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export type FuzzInput =
  | { type: 'integer'; case: IntegerEdgeCase }
  | { type: 'string'; case: StringEdgeCase }
  | { type: 'vector'; case: VectorEdgeCase };

/** All edge-case inputs across every generator, as a flat list of
 * tagged `FuzzInput`s ready to feed into the fuzzing runner. */
export function generateAllEdgeCases(): FuzzInput[] {
  return [
    ...generateAllIntegerEdgeCases().map((c): FuzzInput => ({ type: 'integer', case: c })),
    ...generateStringEdgeCases().map((c): FuzzInput => ({ type: 'string', case: c })),
    ...generateVectorEdgeCases().map((c): FuzzInput => ({ type: 'vector', case: c })),
  ];
}
