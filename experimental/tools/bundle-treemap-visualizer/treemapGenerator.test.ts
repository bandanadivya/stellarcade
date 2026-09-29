import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  computeTreemapLayout,
  generateTreemapHtml,
  scanDirectory,
  topFilesByDiskWeight,
} from './treemapGenerator';
import type { DirectorySizeNode, FileSizeNode, SizeNode } from './types';

function makeTempTree(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'treemap-fixture-'));
  fs.writeFileSync(path.join(root, 'a.txt'), 'x'.repeat(100));
  fs.mkdirSync(path.join(root, 'sub'));
  fs.writeFileSync(path.join(root, 'sub', 'b.txt'), 'y'.repeat(200));
  fs.mkdirSync(path.join(root, 'sub', 'nested'));
  fs.writeFileSync(path.join(root, 'sub', 'nested', 'c.txt'), 'z'.repeat(50));
  return root;
}

// ---------------------------------------------------------------------------
// 1. file scanner computes accurate directory size totals
// ---------------------------------------------------------------------------

describe('scanDirectory', () => {
  it('computes accurate directory size totals across nested subdirectories', () => {
    const root = makeTempTree();
    try {
      const result = scanDirectory({ dir: root });
      // 100 + 200 + 50 = 350 bytes total across the whole tree.
      expect(result.sizeBytes).toBe(350);

      const sub = result.children.find((c): c is DirectorySizeNode => c.kind === 'directory' && c.name === 'sub');
      expect(sub).toBeDefined();
      expect(sub!.sizeBytes).toBe(250); // 200 + 50

      const nested = sub!.children.find(
        (c): c is DirectorySizeNode => c.kind === 'directory' && c.name === 'nested'
      );
      expect(nested!.sizeBytes).toBe(50);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('computes correct gzip/brotli sizes for a file using real zlib compression', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'treemap-fixture-'));
    try {
      const content = 'a'.repeat(10_000); // highly compressible
      fs.writeFileSync(path.join(root, 'big.txt'), content);

      const result = scanDirectory({ dir: root });
      const file = result.children[0] as FileSizeNode;
      expect(file.sizeBytes).toBe(10_000);
      expect(file.gzipBytes).toBeGreaterThan(0);
      expect(file.gzipBytes).toBeLessThan(file.sizeBytes);
      expect(file.brotliBytes).toBeGreaterThan(0);
      expect(file.brotliBytes).toBeLessThan(file.sizeBytes);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('excludes default noise directories like node_modules', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'treemap-fixture-'));
    try {
      fs.mkdirSync(path.join(root, 'node_modules'));
      fs.writeFileSync(path.join(root, 'node_modules', 'huge.js'), 'x'.repeat(5_000));
      fs.writeFileSync(path.join(root, 'real.js'), 'y'.repeat(10));

      const result = scanDirectory({ dir: root });
      expect(result.children.some((c) => c.name === 'node_modules')).toBe(false);
      expect(result.sizeBytes).toBe(10);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws for a non-existent directory', () => {
    expect(() => scanDirectory({ dir: '/definitely/does/not/exist/xyz' })).toThrow();
  });
});

describe('topFilesByDiskWeight', () => {
  it('returns files sorted descending by size, capped at n', () => {
    const root = makeTempTree();
    try {
      const result = scanDirectory({ dir: root });
      const top = topFilesByDiskWeight(result, 2);
      expect(top).toHaveLength(2);
      expect(top[0].sizeBytes).toBeGreaterThanOrEqual(top[1].sizeBytes);
      expect(top[0].sizeBytes).toBe(200);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 2. squarified treemap algorithm partitions correctly
// ---------------------------------------------------------------------------

function fileNode(name: string, sizeBytes: number): FileSizeNode {
  return {
    kind: 'file',
    name,
    path: `/fake/${name}`,
    relativePath: name,
    sizeBytes,
    gzipBytes: Math.floor(sizeBytes / 2),
    brotliBytes: Math.floor(sizeBytes / 3),
  };
}

describe('computeTreemapLayout', () => {
  it('conserves total area across a simple 4-item case', () => {
    const nodes: SizeNode[] = [fileNode('a', 100), fileNode('b', 50), fileNode('c', 30), fileNode('d', 20)];
    const bounds = { x: 0, y: 0, width: 200, height: 100 };
    const rects = computeTreemapLayout(nodes, bounds);

    expect(rects).toHaveLength(4);
    const totalArea = rects.reduce((sum, r) => sum + r.width * r.height, 0);
    expect(totalArea).toBeCloseTo(bounds.width * bounds.height, 1);
  });

  it('produces no overlapping rectangles for a simple 3-item case', () => {
    const nodes: SizeNode[] = [fileNode('a', 60), fileNode('b', 30), fileNode('c', 10)];
    const bounds = { x: 0, y: 0, width: 120, height: 60 };
    const rects = computeTreemapLayout(nodes, bounds);

    function overlaps(r1: (typeof rects)[number], r2: (typeof rects)[number]): boolean {
      const eps = 1e-6;
      return (
        r1.x < r2.x + r2.width - eps &&
        r1.x + r1.width - eps > r2.x &&
        r1.y < r2.y + r2.height - eps &&
        r1.y + r1.height - eps > r2.y
      );
    }

    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        expect(overlaps(rects[i], rects[j])).toBe(false);
      }
    }
  });

  it('gives larger nodes proportionally larger area', () => {
    const nodes: SizeNode[] = [fileNode('big', 800), fileNode('small', 200)];
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const rects = computeTreemapLayout(nodes, bounds);

    const bigRect = rects.find((r) => r.node.name === 'big')!;
    const smallRect = rects.find((r) => r.node.name === 'small')!;
    const bigArea = bigRect.width * bigRect.height;
    const smallArea = smallRect.width * smallRect.height;

    expect(bigArea / smallArea).toBeCloseTo(4, 0); // 800:200 = 4:1
  });

  it('returns an empty layout for an empty node list', () => {
    expect(computeTreemapLayout([], { x: 0, y: 0, width: 100, height: 100 })).toEqual([]);
  });

  it('skips zero-size nodes without producing degenerate rectangles', () => {
    const nodes: SizeNode[] = [fileNode('real', 100), fileNode('empty', 0)];
    const rects = computeTreemapLayout(nodes, { x: 0, y: 0, width: 100, height: 100 });
    expect(rects).toHaveLength(1);
    expect(rects[0].node.name).toBe('real');
  });

  it('keeps every rectangle within the given bounds', () => {
    const nodes: SizeNode[] = [fileNode('a', 40), fileNode('b', 35), fileNode('c', 15), fileNode('d', 10)];
    const bounds = { x: 10, y: 10, width: 150, height: 90 };
    const rects = computeTreemapLayout(nodes, bounds);

    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(bounds.x - 1e-6);
      expect(rect.y).toBeGreaterThanOrEqual(bounds.y - 1e-6);
      expect(rect.x + rect.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1e-6);
      expect(rect.y + rect.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1e-6);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. HTML generator produces valid HTML5 with an embedded <svg> element
// ---------------------------------------------------------------------------

describe('generateTreemapHtml', () => {
  it('produces a valid HTML5 document with an embedded <svg> element', () => {
    const root: DirectorySizeNode = {
      kind: 'directory',
      name: 'my-package',
      path: '/fake',
      relativePath: '.',
      sizeBytes: 300,
      children: [fileNode('index.js', 200), fileNode('readme.md', 100)],
    };

    const html = generateTreemapHtml(root);

    expect(html.trimStart().startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toMatch(/<svg[^>]*>/);
    expect(html).toContain('</svg>');
    expect(html).toContain('my-package');
  });

  it('embeds a top-10-files table containing the scanned file names', () => {
    const root: DirectorySizeNode = {
      kind: 'directory',
      name: 'pkg',
      path: '/fake',
      relativePath: '.',
      sizeBytes: 300,
      children: [fileNode('index.js', 200), fileNode('readme.md', 100)],
    };

    const html = generateTreemapHtml(root);
    expect(html).toContain('index.js');
    expect(html).toContain('readme.md');
    expect(html).toContain('<table>');
  });

  it('escapes special characters in file/directory names to keep the HTML well-formed', () => {
    const root: DirectorySizeNode = {
      kind: 'directory',
      name: 'pkg',
      path: '/fake',
      relativePath: '.',
      sizeBytes: 10,
      children: [fileNode('<script>alert(1)</script>.js', 10)],
    };

    const html = generateTreemapHtml(root);
    expect(html).not.toContain('<script>alert(1)</script>.js');
    expect(html).toContain('&lt;script&gt;');
  });
});
