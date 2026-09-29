#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { Command } from 'commander';
import { generateTreemapHtml, scanDirectory, topFilesByDiskWeight } from './treemapGenerator';

const program = new Command();

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/** Best-effort cross-platform "open in browser". A no-op (with a logged
 * note) on platforms this isn't wired for, so `--open` never crashes the
 * CLI — it's a convenience, not a requirement. This is a pure fs
 * scanner/report generator; it never runs a build on the target. */
function openInBrowser(filePath: string): void {
  const absPath = path.resolve(filePath);
  const platform = process.platform;

  let command: string | null = null;
  if (platform === 'darwin') {
    command = `open "${absPath}"`;
  } else if (platform === 'win32') {
    command = `start "" "${absPath}"`;
  } else if (platform === 'linux') {
    command = `xdg-open "${absPath}"`;
  }

  if (!command) {
    console.log(`(--open is not wired for platform "${platform}"; open ${absPath} manually)`);
    return;
  }

  exec(command, (err) => {
    if (err) {
      console.log(`Could not auto-open the report (${err.message}); open ${absPath} manually.`);
    }
  });
}

program
  .name('bundle-treemap-visualizer')
  .description(
    'Scan a directory and generate a self-contained interactive HTML treemap of file/directory sizes. ' +
      'Pure filesystem scanner — never runs a build on the scanned target.'
  )
  .version('0.0.1')
  .requiredOption('--dir <path>', 'Directory to scan')
  .option('--out <file>', 'Output HTML report path', './treemap-report.html')
  .option('--open', 'Attempt to auto-open the generated report in a browser', false)
  .option('--exclude <names>', 'Comma-separated directory names to exclude, in addition to the defaults', '')
  .action(async (options) => {
    try {
      const excludeNames = options.exclude
        ? options.exclude.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      const root = scanDirectory({ dir: options.dir, excludeNames });
      const html = generateTreemapHtml(root);

      fs.writeFileSync(options.out, html);

      const topFiles = topFilesByDiskWeight(root, 10);
      console.log(`Scanned ${options.dir} — total size ${formatBytes(root.sizeBytes)}\n`);
      console.log('Top 10 largest files by disk weight:');
      console.log('# | Path | Size | Gzip | Brotli');
      console.log('---|---|---|---|---');
      topFiles.forEach((f, i) => {
        console.log(
          `${i + 1} | ${f.relativePath} | ${formatBytes(f.sizeBytes)} | ${formatBytes(f.gzipBytes)} | ${formatBytes(f.brotliBytes)}`
        );
      });

      console.log(`\nReport written to ${options.out}`);

      if (options.open) {
        openInBrowser(options.out);
      }
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

export { generateTreemapHtml, scanDirectory, topFilesByDiskWeight } from './treemapGenerator';
export * from './types';
