# Tournament Match VS Card

An arcade head-to-head match card component for tournament brackets, match listings, and duel preview screens.

> **Status:** experimental, self-contained component under `experimental/ui/`. It does not modify core `apps/web/` surfaces.

## Features

- **Dual-player layout:** Head-to-head avatar and player display with a stylized 'VS' divider.
- **Player statistics:** Player usernames, formatted Stellar public keys, and historical win rates.
- **Match escrow prize pool:** Highlighted total XLM reward pool.
- **Live status indicators:** Status badges for `Upcoming`, `In Progress` (pulsing glow), `Settled`, and `Forfeited`.
- **Settled match winner highlight:** Prominent golden border, glow, and "Winner" ribbon badge.
- **Missing opponent handling:** Graceful fallback when opponent is pending or anonymous ("Awaiting Opponent").
- **Interactive actions:** Contextual action button triggering `onActionClick(matchId)`.

## Props

See `types.ts` for full type definitions:

```typescript
export interface TournamentMatchCardProps {
  match: TournamentMatchData;
  onActionClick?: (matchId: string) => void;
  actionLabel?: string;
  className?: string;
}
```

## Installation

```bash
cd experimental/ui/tournament-match-card
npm install
```

## Testing

```bash
npm test
```
