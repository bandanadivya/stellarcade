/**
 * Shared types for the bundle treemap visualizer: a standalone,
 * dependency-free filesystem scanner and squarified-treemap report
 * generator. Never runs a build against the scanned target — it only
 * reads file sizes and content via Node's `fs`/`zlib`.
 */

export interface FileSizeNode {
  kind: 'file';
  name: string;
  /** Absolute path on disk. */
  path: string;
  /** Path relative to the scan root, for display. */
  relativePath: string;
  sizeBytes: number;
  gzipBytes: number;
  brotliBytes: number;
}

export interface DirectorySizeNode {
  kind: 'directory';
  name: string;
  path: string;
  relativePath: string;
  sizeBytes: number;
  children: SizeNode[];
}

export type SizeNode = FileSizeNode | DirectorySizeNode;

/** A rectangle computed by the squarified treemap tiling algorithm,
 * proportional to its node's `sizeBytes` within its parent's allotted
 * area. Coordinates are in the same abstract unit as the root area
 * passed into `computeTreemapLayout` (the renderer maps this to SVG
 * pixel units). */
export interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  node: SizeNode;
}

export interface ScanOptions {
  dir: string;
  /** Glob-free, simple name-based excludes (e.g. `node_modules`, `.git`). */
  excludeNames?: string[];
}

export interface TopFileEntry {
  relativePath: string;
  sizeBytes: number;
  gzipBytes: number;
  brotliBytes: number;
}
