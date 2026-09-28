# Guild Clan Leaderboard Banner

An arcade showcase banner component highlighting the top 3 guild clans on a podium with Gold, Silver, and Bronze trims, crest badges, seasonal volume stats, and an interactive 'Join Clan' call-to-action.

> **Status:** experimental, self-contained component under `experimental/ui/`. It does not modify core `apps/web/` surfaces.

## Features

- **Podium ranks:** Top 3 guild ranking display with 1st place gold, 2nd place silver, and 3rd place bronze badge trims.
- **Guild crests:** Crest avatar image rendering with automatic two-letter initials fallback.
- **Clan statistics:** Member count, win rate percentage, and total seasonal volume in XLM.
- **Join clan callback:** Interactive CTA button triggering `onJoinGuild(guildId)`.
- **Season pending empty state:** Fallback display when the current tournament season has not yet launched.
- **Responsive design:** Flexible flex-wrap layout adjusting gracefully to mobile and desktop viewports.

## Props

See `types.ts` for full definitions:

```typescript
export interface GuildLeaderboardBannerProps {
  guilds: GuildLeaderboardEntry[];
  seasonLabel?: string;
  onJoinGuild?: (guildId: string) => void;
  className?: string;
}
```

## Installation

```bash
cd experimental/ui/guild-leaderboard-banner
npm install
```

## Testing

```bash
npm test
```
