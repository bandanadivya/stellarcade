#!/usr/bin/env node

import * as fs from 'fs';
import { Command } from 'commander';
import { analyzeContractStorage, formatReport } from './storageAnalyzer';

const program = new Command();

program
  .name('contract-state-pruner')
  .description(
    'Read-only CLI that reports how close a Soroban contract\'s storage entries are to TTL expiration, ' +
      'and estimates the stroops cost of extending them. Never submits a transaction or mutates state.'
  )
  .version('0.0.1')
  .requiredOption('--contract <id>', "Contract's C... strkey")
  .option('--rpc-url <url>', 'Soroban RPC endpoint URL', 'https://soroban-testnet.stellar.org')
  .option('--bump-ledgers <num>', 'Ledger count to estimate a TTL bump for', '100000')
  .option('--warn-threshold <num>', 'Warn when ledgers-remaining is at or below this', '10000')
  .option('--keys <symbols>', 'Comma-separated persistent storage key Symbols to inspect', '')
  .option('--temp-keys <symbols>', 'Comma-separated temporary storage key Symbols to inspect', '')
  .option('--out <file>', 'Write the report as JSON to this file instead of printing a table')
  .option('--json', 'Print the raw JSON report to stdout instead of a formatted table', false)
  .action(async (options) => {
    const bumpLedgers = parseInt(options.bumpLedgers, 10);
    const warnThreshold = parseInt(options.warnThreshold, 10);

    if (Number.isNaN(bumpLedgers) || bumpLedgers < 0) {
      console.error('Error: --bump-ledgers must be a non-negative integer');
      process.exitCode = 2;
      return;
    }
    if (Number.isNaN(warnThreshold) || warnThreshold < 0) {
      console.error('Error: --warn-threshold must be a non-negative integer');
      process.exitCode = 2;
      return;
    }

    const persistentKeys: string[] = options.keys
      ? options.keys.split(',').map((k: string) => k.trim()).filter(Boolean)
      : [];
    const temporaryKeys: string[] = options.tempKeys
      ? options.tempKeys.split(',').map((k: string) => k.trim()).filter(Boolean)
      : [];

    try {
      const report = await analyzeContractStorage({
        contractId: options.contract,
        rpcUrl: options.rpcUrl,
        bumpLedgers,
        warnThresholdLedgers: warnThreshold,
        persistentKeys,
        temporaryKeys,
      });

      if (options.out) {
        fs.writeFileSync(options.out, JSON.stringify(report, null, 2));
        console.log(`Report written to ${options.out}`);
      } else if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatReport(report));
      }

      const anyNearExpiration = report.entries.some((e) => e.nearExpiration);
      process.exitCode = anyNearExpiration ? 1 : 0;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('An unexpected error occurred');
      }
      process.exitCode = 2;
    }
  });

if (require.main === module) {
  program.parseAsync(process.argv);
}

export { analyzeContractStorage, formatReport } from './storageAnalyzer';
export * from './types';
