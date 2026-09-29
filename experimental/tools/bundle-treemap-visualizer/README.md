# bundle-treemap-visualizer

A standalone, zero-heavy-dependency package-size treemap generator. Scans
a directory tree, computes a squarified treemap layout proportional to
file/directory sizes, and writes a single self-contained interactive HTML
report with an embedded inline SVG.

> **Status:** experimental, self-contained tool under `experimental/tools/`.
> It does not modify or depend on any core repo tooling.

## Pure filesystem scanner — never runs a build

This tool only reads: it walks the target directory with Node's built-in
`fs` and measures byte sizes, and computes gzip/brotli compressed size
per file with Node's built-in `zlib` (`zlib.gzipSync` /
`zlib.brotliCompressSync`, run against real file contents, not an
approximation). It never invokes `npm run build`, a bundler, or any other
command against the directory being scanned. "Zero heavy dependencies"
means no npm packages beyond `commander` for CLI flag parsing — `fs` and
`zlib` are Node stdlib.

## What it does

1. Recursively walks `--dir`, building a tree of `{kind: 'file' |
   'directory', sizeBytes, ...}` nodes. Directory size is the sum of its
   descendants. `node_modules`, `.git`, `dist`, and `target` are excluded
   by default (add more via `--exclude`).
2. Computes a **squarified treemap layout** (Bruls/Huizing/van Wijk
   algorithm) for each directory's children: nodes are placed into
   size-descending "rows" chosen to minimize the worst width:height
   aspect ratio in that row, which is what keeps rectangles close to
   square (readable) instead of long slivers.
3. Renders a single self-contained HTML file (`--out`) with:
   - An inline SVG treemap — one `<rect>` per file/directory, sized and
     positioned per the layout, with a native SVG `<title>` element per
     rectangle for hover tooltips (no JS needed for tooltips).
   - Click-to-drill-down into a subdirectory, via a small inline
     vanilla-JS re-render (the full node tree is embedded as JSON in the
     page and the same squarify algorithm is re-run client-side — no
     external JS libraries, no network calls, no server).
   - A "Top 10 largest files" table.
4. Prints the same top-10 summary to stdout as a table.

The generated report is a single `.html` file with no external script/
stylesheet/font references — open it directly from disk in any browser.

## CLI usage

```
bundle-treemap-visualizer --dir <path> [--out <report.html>] [--open] [--exclude <names>]
```

Flags:

| Flag | Required | Description |
|---|---|---|
| `--dir <path>` | yes | Directory to scan |
| `--out <file>` | no | Output HTML report path (default `./treemap-report.html`) |
| `--open` | no | Attempt to auto-open the report in a browser after writing it |
| `--exclude <names>` | no | Comma-separated directory names to exclude, in addition to the defaults (`node_modules`, `.git`, `dist`, `target`) |

### Example

```bash
npx ts-node cli.ts --dir ../../../backend --out backend-treemap.html
```

### `--open` behavior

`--open` shells out to the platform's native "open" command (`open` on
macOS, `start` on Windows, `xdg-open` on Linux) via
`child_process.exec`. On any other platform, or if the command fails, it
logs a note and does nothing further — it never crashes the CLI, since
auto-opening is a convenience, not a requirement.

## Library usage

```ts
import { scanDirectory, computeTreemapLayout, generateTreemapHtml } from '@stellarcade/bundle-treemap-visualizer';

const root = scanDirectory({ dir: './my-package' });
const html = generateTreemapHtml(root);
```

## Testing

```bash
npm test
```

Covers: the filesystem scanner's directory size totals across nested
subdirectories (via a temp fixture tree), real gzip/brotli size
computation, default-exclude behavior, and missing-directory handling;
the squarified treemap algorithm's total-area conservation, no-overlap
guarantee, proportional sizing, and bounds-containment for simple 3-4
item cases; and the HTML generator's HTML5 structure, embedded `<svg>`
element, top-10-files table content, and XML-escaping of file/directory
names (so a file literally named e.g. `<script>...` can't break the
generated markup).
