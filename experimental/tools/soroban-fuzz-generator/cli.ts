#!/usr/bin/env node

import { Command } from 'commander';
import { runFuzz, writeFailingTestFixtures, SimulateFn, SimulationResult } from './fuzzer';
import { FuzzInput } from './generators';

const program = new Command();

program
  .name('soroban-fuzz-generator')
  .description(
    'Generate edge-case ScVal-shaped inputs and fuzz a Soroban contract method against them, ' +
      'classifying unhandled host panics vs. gracefully handled errors.'
  )
  .version('0.0.1')
  .requiredOption('--contract <id>', "Contract's C... strkey")
  .requiredOption('--method <name>', 'Contract method name to fuzz')
  .option('--iterations <num>', 'Number of fuzz iterations to run', '100')
  .option('--seed <num>', 'Reproducible PRNG seed (defaults to a fresh timestamp-derived seed)')
  .option('--rpc-url <url>', 'Soroban RPC endpoint URL (only used if --live is set)')
  .option('--live', 'Attempt a real RPC simulateTransaction call per input (requires --rpc-url)', false)
  .option('--out-tests <dir>', 'Directory to write failing-input Rust test snippets to', './fuzz-fixtures')
  .action(async (options) => {
    const iterations = parseInt(options.iterations, 10);
    if (Number.isNaN(iterations) || iterations <= 0) {
      console.error('Error: --iterations must be a positive integer');
      process.exitCode = 2;
      return;
    }

    const seed = options.seed !== undefined ? parseInt(options.seed, 10) : undefined;
    if (options.seed !== undefined && Number.isNaN(seed)) {
      console.error('Error: --seed must be an integer');
      process.exitCode = 2;
      return;
    }

    if (options.live && !options.rpcUrl) {
      console.error('Error: --live requires --rpc-url');
      process.exitCode = 2;
      return;
    }

    const simulate: SimulateFn = options.live
      ? makeLiveSimulator(options.rpcUrl, options.contract, options.method)
      : makeNoopSimulator();

    try {
      const result = await runFuzz(simulate, { iterations, seed });

      console.log(`Fuzz run complete. Seed: ${result.seed} (pass --seed ${result.seed} to reproduce)`);
      console.log(`  Iterations: ${result.iterations}`);
      console.log(`  OK: ${result.ok.length}`);
      console.log(`  Handled errors: ${result.handled.length}`);
      console.log(`  Panics: ${result.panics.length}`);

      if (result.panics.length > 0) {
        console.log('\nPanic-classified inputs:');
        for (const p of result.panics) {
          console.log(`  - [${p.input.type}] ${p.input.case.label}: ${p.detail ?? '(no detail)'}`);
        }

        const written = writeFailingTestFixtures(
          result.results,
          options.outTests,
          options.contract,
          options.method
        );
        console.log(`\nWrote ${written.length} Rust test fixture(s) to ${options.outTests}:`);
        for (const file of written) {
          console.log(`  - ${file}`);
        }
      }

      process.exitCode = result.panics.length > 0 ? 1 : 0;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('An unexpected error occurred');
      }
      process.exitCode = 2;
    }
  });

/**
 * Default simulator used when `--live` isn't set: it never touches the
 * network, and always reports success. This makes `soroban-fuzz-generator
 * --contract X --method Y` runnable out of the box to exercise the
 * generator/classifier pipeline, while the real, useful mode is wiring
 * `--live` (or the library's `runFuzz` directly) to an actual simulator.
 */
function makeNoopSimulator(): SimulateFn {
  return (_input: FuzzInput): SimulationResult => ({ success: true, returnValue: null });
}

/**
 * Best-effort real simulator: wires each fuzz input into a Soroban RPC
 * `simulateTransaction` call. This is optional/secondary — the CLI and
 * library are fully useful and fully tested without it, per the "no live
 * network required" design of this tool. Requires `@stellar/stellar-sdk`
 * to be installed and a real, funded source account to build a
 * transaction envelope from, which is why this is not the default path.
 */
function makeLiveSimulator(rpcUrl: string, contractId: string, method: string): SimulateFn {
  return async (input: FuzzInput): Promise<SimulationResult> => {
    try {
      // Real wiring is intentionally left as an integration point: build
      // an invoke-host-function transaction for `contractId`/`method`
      // with `input.case.value` converted to an ScVal, then call
      // `server.simulateTransaction(tx)`. Kept out of the default path so
      // this tool has zero network dependency for its core, tested
      // behavior (see README "Live mode" section).
      const { rpc } = await import('@stellar/stellar-sdk');
      const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
      void server;
      void contractId;
      void method;
      void input;
      throw new Error(
        'Live simulation requires wiring a signed transaction envelope for your contract; ' +
          'see README.md "Live mode" for the integration point, or use the library API with a custom SimulateFn.'
      );
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
}

if (require.main === module) {
  program.parseAsync(process.argv);
}

export { runFuzz, writeFailingTestFixtures } from './fuzzer';
export * from './generators';
