# Jackpot Milestone Progress Gauge

An arcade SVG radial progress gauge displaying accumulated pool balance against a guarantee threshold, milestone notches, countdowns, and bonus multiplier triggers.

> **Status:** experimental, self-contained component under `experimental/ui/`. It does not modify core `apps/web/` surfaces.

## Features

- **Radial SVG gauge:** SVG circular progress bar reflecting current pool accumulation towards unlock target.
- **Clean percentage clamping:** Progress is reliably clamped to `[0, 100]%` via `clampProgress()`, gracefully handling 0 or negative values.
- **Urgent capacity pulse:** Triggers glowing red pulse animation when capacity exceeds 90%.
- **Milestone notch indicators:** Checkpoint markers (50%, 75%, 100% trigger line) illuminating when passed.
- **Breakdown tooltip:** Hover/focus tooltip detailing house seeding vs player fee contributions.
- **Accessible:** Semantic SVG with `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.

## Props

See `types.ts` for full definitions:

```typescript
export interface JackpotMilestoneProgressProps {
  currentPoolXlm: number;
  targetThresholdXlm: number;
  estimatedTimeToDrop?: string;
  houseSeedXlm?: number;
  playerFeesXlm?: number;
  bonusMultiplier?: number;
  className?: string;
}
```

## Installation

```bash
cd experimental/ui/jackpot-milestone-progress
npm install
```

## Testing

```bash
npm test
```
