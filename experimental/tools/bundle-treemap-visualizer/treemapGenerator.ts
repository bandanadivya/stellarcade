import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import {
  DirectorySizeNode,
  FileSizeNode,
  ScanOptions,
  SizeNode,
  TopFileEntry,
  TreemapRect,
} from './types';

const DEFAULT_EXCLUDES = new Set(['node_modules', '.git', 'dist', 'target']);

// ---------------------------------------------------------------------------
// Filesystem scanner
// ---------------------------------------------------------------------------

/** Recursively scan `options.dir`, measuring file and directory byte
 * sizes and computing gzip/brotli compressed size per file via Node's
 * built-in `zlib` (real compression of the actual file contents, not an
 * approximation). Uses only Node's `fs`/`zlib` — no external scanning
 * dependencies. Never invokes a build/bundler on the scanned target. */
export function scanDirectory(options: ScanOptions): DirectorySizeNode {
  const rootDir = path.resolve(options.dir);
  if (!fs.existsSync(rootDir)) {
    throw new Error(`Directory does not exist: ${rootDir}`);
  }
  if (!fs.statSync(rootDir).isDirectory()) {
    throw new Error(`Not a directory: ${rootDir}`);
  }

  const excludes = new Set([...DEFAULT_EXCLUDES, ...(options.excludeNames ?? [])]);

  return scanNode(rootDir, rootDir, excludes);
}

function scanNode(absPath: string, rootDir: string, excludes: Set<string>): DirectorySizeNode {
  const name = path.basename(absPath) || absPath;
  const entries = fs
    .readdirSync(absPath, { withFileTypes: true })
    .filter((entry) => !excludes.has(entry.name));

  const children: SizeNode[] = [];
  let totalSize = 0;

  for (const entry of entries) {
    const childPath = path.join(absPath, entry.name);

    if (entry.isDirectory()) {
      const childNode = scanNode(childPath, rootDir, excludes);
      children.push(childNode);
      totalSize += childNode.sizeBytes;
    } else if (entry.isFile()) {
      const fileNode = scanFile(childPath, rootDir);
      children.push(fileNode);
      totalSize += fileNode.sizeBytes;
    }
    // Symlinks and other special files are skipped.
  }

  // Largest first, for stable/predictable treemap layout and top-N lists.
  children.sort((a, b) => b.sizeBytes - a.sizeBytes);

  return {
    kind: 'directory',
    name,
    path: absPath,
    relativePath: path.relative(rootDir, absPath) || '.',
    sizeBytes: totalSize,
    children,
  };
}

function scanFile(absPath: string, rootDir: string): FileSizeNode {
  const contents = fs.readFileSync(absPath);
  const sizeBytes = contents.length;
  const gzipBytes = zlib.gzipSync(contents).length;
  const brotliBytes = zlib.brotliCompressSync(contents).length;

  return {
    kind: 'file',
    name: path.basename(absPath),
    path: absPath,
    relativePath: path.relative(rootDir, absPath),
    sizeBytes,
    gzipBytes,
    brotliBytes,
  };
}

/** Flatten every file node in the tree (depth-first). */
export function flattenFiles(node: SizeNode): FileSizeNode[] {
  if (node.kind === 'file') return [node];
  return node.children.flatMap(flattenFiles);
}

/** Top `n` largest files by disk (uncompressed) weight, descending. */
export function topFilesByDiskWeight(root: DirectorySizeNode, n = 10): TopFileEntry[] {
  return flattenFiles(root)
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, n)
    .map((f) => ({
      relativePath: f.relativePath,
      sizeBytes: f.sizeBytes,
      gzipBytes: f.gzipBytes,
      brotliBytes: f.brotliBytes,
    }));
}

// ---------------------------------------------------------------------------
// Squarified treemap tiling algorithm
// ---------------------------------------------------------------------------

/**
 * Compute a squarified treemap layout for `nodes` within the rectangle
 * `{x, y, width, height}`. Implements the standard squarified algorithm
 * (Bruls, Huizing, van Wijk): nodes are laid out in size-descending
 * "rows" that are each filled to minimize the maximum
 * width-to-height aspect ratio of the rectangles in that row, before
 * starting a new row — this is what keeps rectangles close to square
 * (readable) rather than long/thin slivers.
 *
 * Zero-size nodes are skipped (they'd otherwise produce degenerate
 * zero-area rectangles). Total allotted area is conserved: the sum of
 * output rectangle areas equals `width * height` scaled by the fraction
 * of total size actually covered by non-zero nodes.
 */
export function computeTreemapLayout(
  nodes: SizeNode[],
  bounds: { x: number; y: number; width: number; height: number }
): TreemapRect[] {
  const sized = nodes.filter((n) => n.sizeBytes > 0);
  if (sized.length === 0 || bounds.width <= 0 || bounds.height <= 0) return [];

  const totalSize = sized.reduce((sum, n) => sum + n.sizeBytes, 0);
  const totalArea = bounds.width * bounds.height;
  // Scale each node's size to an area proportional to its share of totalSize.
  const scale = totalArea / totalSize;

  const sortedDesc = [...sized].sort((a, b) => b.sizeBytes - a.sizeBytes);
  const results: TreemapRect[] = [];

  squarify(
    sortedDesc.map((n) => ({ node: n, area: n.sizeBytes * scale })),
    [],
    { ...bounds },
    results
  );

  return results;
}

interface AreaItem {
  node: SizeNode;
  area: number;
}

function squarify(
  remaining: AreaItem[],
  currentRow: AreaItem[],
  bounds: { x: number; y: number; width: number; height: number },
  output: TreemapRect[]
): void {
  if (remaining.length === 0) {
    if (currentRow.length > 0) {
      layoutRow(currentRow, bounds, output);
    }
    return;
  }

  const shortestSide = Math.min(bounds.width, bounds.height);
  const next = remaining[0];
  const rowWithNext = [...currentRow, next];

  if (
    currentRow.length === 0 ||
    worstAspectRatio(currentRow, shortestSide) >= worstAspectRatio(rowWithNext, shortestSide)
  ) {
    squarify(remaining.slice(1), rowWithNext, bounds, output);
  } else {
    const newBounds = layoutRow(currentRow, bounds, output);
    squarify(remaining, [], newBounds, output);
  }
}

function worstAspectRatio(row: AreaItem[], shortestSide: number): number {
  const totalArea = row.reduce((sum, item) => sum + item.area, 0);
  if (totalArea === 0) return Infinity;

  const maxArea = Math.max(...row.map((item) => item.area));
  const minArea = Math.min(...row.map((item) => item.area));

  const s2 = shortestSide * shortestSide;
  const ratio1 = (s2 * maxArea) / (totalArea * totalArea);
  const ratio2 = (totalArea * totalArea) / (s2 * minArea);
  return Math.max(ratio1, ratio2);
}

/** Lay out `row` along the shorter side of `bounds`, append rectangles to
 * `output`, and return the remaining bounds for subsequent rows. */
function layoutRow(
  row: AreaItem[],
  bounds: { x: number; y: number; width: number; height: number },
  output: TreemapRect[]
): { x: number; y: number; width: number; height: number } {
  const rowArea = row.reduce((sum, item) => sum + item.area, 0);
  const isHorizontal = bounds.width >= bounds.height;

  if (isHorizontal) {
    // Row occupies a vertical strip of the given thickness on the left.
    const rowWidth = rowArea / bounds.height;
    let cursorY = bounds.y;
    for (const item of row) {
      const rectHeight = item.area / rowWidth;
      output.push({ x: bounds.x, y: cursorY, width: rowWidth, height: rectHeight, node: item.node });
      cursorY += rectHeight;
    }
    return {
      x: bounds.x + rowWidth,
      y: bounds.y,
      width: bounds.width - rowWidth,
      height: bounds.height,
    };
  }

  // Row occupies a horizontal strip of the given thickness on top.
  const rowHeight = rowArea / bounds.width;
  let cursorX = bounds.x;
  for (const item of row) {
    const rectWidth = item.area / rowHeight;
    output.push({ x: cursorX, y: bounds.y, width: rectWidth, height: rowHeight, node: item.node });
    cursorX += rectWidth;
  }
  return {
    x: bounds.x,
    y: bounds.y + rowHeight,
    width: bounds.width,
    height: bounds.height - rowHeight,
  };
}

// ---------------------------------------------------------------------------
// HTML report generator (self-contained, no network dependencies)
// ---------------------------------------------------------------------------

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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

const PALETTE = ['#4f7cff', '#38b48b', '#f2a541', '#e0577b', '#8b6fd6', '#3fb6c9'];

function colorForDepth(depth: number): string {
  return PALETTE[depth % PALETTE.length];
}

function renderRectSvg(rect: TreemapRect, depth: number): string {
  const { x, y, width, height, node } = rect;
  if (width <= 0 || height <= 0) return '';

  const fill = node.kind === 'directory' ? colorForDepth(depth) : '#c9d6ff';
  const label = `${node.name} — ${formatBytes(node.sizeBytes)}`;
  const clickHandler = node.kind === 'directory' ? ` onclick="drillDown('${escapeXml(node.relativePath)}')"` : '';

  const textFits = width > 40 && height > 14;

  return `
    <g class="node" data-path="${escapeXml(node.relativePath)}" data-kind="${node.kind}"${clickHandler}>
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}"
            fill="${fill}" stroke="#1a1f2b" stroke-width="0.5" class="${node.kind === 'directory' ? 'dir-rect' : 'file-rect'}">
        <title>${escapeXml(label)}</title>
      </rect>
      ${textFits ? `<text x="${(x + 4).toFixed(2)}" y="${(y + 12).toFixed(2)}" font-size="10" fill="#0b0d12" pointer-events="none">${escapeXml(node.name)}</text>` : ''}
    </g>`;
}

export interface RenderOptions {
  width?: number;
  height?: number;
}

/** Generate a single self-contained HTML file embedding an interactive
 * inline SVG treemap for `root`. No external JS/CSS libraries and no
 * network dependencies — hover tooltips use native SVG `<title>`
 * elements, and click-to-drill-down uses a small inline vanilla-JS
 * re-render. */
export function generateTreemapHtml(root: DirectorySizeNode, options: RenderOptions = {}): string {
  const width = options.width ?? 1200;
  const height = options.height ?? 700;

  const layout = computeTreemapLayout(root.children, { x: 0, y: 0, width, height });
  const svgBody = layout.map((rect) => renderRectSvg(rect, 1)).join('\n');
  const topFiles = topFilesByDiskWeight(root, 10);

  const topFilesRows = topFiles
    .map(
      (f, i) =>
        `<tr><td>${i + 1}</td><td>${escapeXml(f.relativePath)}</td><td>${formatBytes(f.sizeBytes)}</td><td>${formatBytes(f.gzipBytes)}</td><td>${formatBytes(f.brotliBytes)}</td></tr>`
    )
    .join('\n');

  // The full node tree is embedded as JSON so the inline script can
  // re-run the (also embedded) squarify layout client-side for
  // click-to-drill-down, without any network fetch or external bundle.
  const treeJson = JSON.stringify(root).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Bundle Treemap — ${escapeXml(root.name)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 16px; background: #0b0d12; color: #e6e9f0; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .subtitle { color: #9aa4b8; font-size: 12px; margin-bottom: 12px; }
  #treemap-container { border: 1px solid #232838; border-radius: 6px; overflow: hidden; background: #12151d; }
  svg { display: block; width: 100%; height: auto; }
  .node rect { cursor: pointer; transition: opacity 0.1s ease; }
  .node rect:hover { opacity: 0.8; }
  table { border-collapse: collapse; margin-top: 16px; font-size: 12px; width: 100%; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #232838; }
  th { color: #9aa4b8; font-weight: 600; }
  #breadcrumb { font-size: 12px; margin-bottom: 8px; color: #9aa4b8; }
  #breadcrumb button { background: none; border: none; color: #4f7cff; cursor: pointer; font-size: 12px; padding: 0; }
</style>
</head>
<body>
  <h1>Bundle Treemap — ${escapeXml(root.name)}</h1>
  <div class="subtitle">Total size: ${formatBytes(root.sizeBytes)} — click a directory rectangle to drill in</div>
  <div id="breadcrumb"></div>
  <div id="treemap-container">
    <svg id="treemap-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${svgBody}
    </svg>
  </div>

  <h2 style="font-size:14px;margin-top:24px;">Top 10 largest files</h2>
  <table>
    <thead><tr><th>#</th><th>Path</th><th>Size</th><th>Gzip</th><th>Brotli</th></tr></thead>
    <tbody>
${topFilesRows}
    </tbody>
  </table>

  <script>
    // Self-contained, dependency-free drill-down: re-runs the same
    // squarify layout used server-side, entirely client-side, against
    // the embedded tree JSON. No network calls.
    (function () {
      var TREE = ${treeJson};
      var WIDTH = ${width};
      var HEIGHT = ${height};
      var PALETTE = ${JSON.stringify(PALETTE)};
      var path = [TREE];

      function formatBytes(bytes) {
        var units = ['B', 'KB', 'MB', 'GB'];
        var value = bytes, unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) { value /= 1024; unitIndex += 1; }
        return value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1) + ' ' + units[unitIndex];
      }

      function worstAspectRatio(row, shortestSide) {
        var totalArea = row.reduce(function (s, i) { return s + i.area; }, 0);
        if (totalArea === 0) return Infinity;
        var maxArea = Math.max.apply(null, row.map(function (i) { return i.area; }));
        var minArea = Math.min.apply(null, row.map(function (i) { return i.area; }));
        var s2 = shortestSide * shortestSide;
        var ratio1 = (s2 * maxArea) / (totalArea * totalArea);
        var ratio2 = (totalArea * totalArea) / (s2 * minArea);
        return Math.max(ratio1, ratio2);
      }

      function layoutRow(row, bounds, output) {
        var rowArea = row.reduce(function (s, i) { return s + i.area; }, 0);
        var isHorizontal = bounds.width >= bounds.height;
        if (isHorizontal) {
          var rowWidth = rowArea / bounds.height;
          var cursorY = bounds.y;
          row.forEach(function (item) {
            var rectHeight = item.area / rowWidth;
            output.push({ x: bounds.x, y: cursorY, width: rowWidth, height: rectHeight, node: item.node });
            cursorY += rectHeight;
          });
          return { x: bounds.x + rowWidth, y: bounds.y, width: bounds.width - rowWidth, height: bounds.height };
        }
        var rowHeight = rowArea / bounds.width;
        var cursorX = bounds.x;
        row.forEach(function (item) {
          var rectWidth = item.area / rowHeight;
          output.push({ x: cursorX, y: bounds.y, width: rectWidth, height: rowHeight, node: item.node });
          cursorX += rectWidth;
        });
        return { x: bounds.x, y: bounds.y + rowHeight, width: bounds.width, height: bounds.height - rowHeight };
      }

      function squarify(remaining, currentRow, bounds, output) {
        if (remaining.length === 0) {
          if (currentRow.length > 0) layoutRow(currentRow, bounds, output);
          return;
        }
        var shortestSide = Math.min(bounds.width, bounds.height);
        var next = remaining[0];
        var rowWithNext = currentRow.concat([next]);
        if (currentRow.length === 0 || worstAspectRatio(currentRow, shortestSide) >= worstAspectRatio(rowWithNext, shortestSide)) {
          squarify(remaining.slice(1), rowWithNext, bounds, output);
        } else {
          var newBounds = layoutRow(currentRow, bounds, output);
          squarify(remaining, [], newBounds, output);
        }
      }

      function computeLayout(nodes, bounds) {
        var sized = nodes.filter(function (n) { return n.sizeBytes > 0; });
        if (sized.length === 0 || bounds.width <= 0 || bounds.height <= 0) return [];
        var totalSize = sized.reduce(function (s, n) { return s + n.sizeBytes; }, 0);
        var totalArea = bounds.width * bounds.height;
        var scale = totalArea / totalSize;
        var sortedDesc = sized.slice().sort(function (a, b) { return b.sizeBytes - a.sizeBytes; });
        var items = sortedDesc.map(function (n) { return { node: n, area: n.sizeBytes * scale }; });
        var output = [];
        squarify(items, [], bounds, output);
        return output;
      }

      function escapeXml(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }

      function render() {
        var current = path[path.length - 1];
        var layout = computeLayout(current.children || [], { x: 0, y: 0, width: WIDTH, height: HEIGHT });
        var svg = document.getElementById('treemap-svg');
        var parts = layout.map(function (rect, idx) {
          if (rect.width <= 0 || rect.height <= 0) return '';
          var node = rect.node;
          var fill = node.kind === 'directory' ? PALETTE[(path.length) % PALETTE.length] : '#c9d6ff';
          var label = node.name + ' — ' + formatBytes(node.sizeBytes);
          var textFits = rect.width > 40 && rect.height > 14;
          return '<g class="node" data-idx="' + idx + '">' +
            '<rect x="' + rect.x.toFixed(2) + '" y="' + rect.y.toFixed(2) + '" width="' + rect.width.toFixed(2) + '" height="' + rect.height.toFixed(2) + '" fill="' + fill + '" stroke="#1a1f2b" stroke-width="0.5"><title>' + escapeXml(label) + '</title></rect>' +
            (textFits ? '<text x="' + (rect.x + 4).toFixed(2) + '" y="' + (rect.y + 12).toFixed(2) + '" font-size="10" fill="#0b0d12" pointer-events="none">' + escapeXml(node.name) + '</text>' : '') +
            '</g>';
        });
        svg.innerHTML = parts.join('\\n');

        Array.prototype.forEach.call(svg.querySelectorAll('.node'), function (g) {
          var idx = Number(g.getAttribute('data-idx'));
          var node = layout[idx].node;
          if (node.kind === 'directory' && node.children && node.children.length > 0) {
            g.style.cursor = 'pointer';
            g.addEventListener('click', function () {
              path.push(node);
              render();
            });
          }
        });

        var breadcrumb = document.getElementById('breadcrumb');
        breadcrumb.innerHTML = path
          .map(function (node, i) {
            if (i === path.length - 1) return escapeXml(node.name);
            return '<button data-jump="' + i + '">' + escapeXml(node.name) + '</button> / ';
          })
          .join('');
        Array.prototype.forEach.call(breadcrumb.querySelectorAll('button'), function (btn) {
          btn.addEventListener('click', function () {
            var jumpTo = Number(btn.getAttribute('data-jump'));
            path = path.slice(0, jumpTo + 1);
            render();
          });
        });
      }

      render();
    })();
  </script>
</body>
</html>
`;
}
