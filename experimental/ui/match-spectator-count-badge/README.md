# Match Spectator Count Badge

An experimental spectator presence badge component for live coinflips and duel matches in the arena workspace.

## Features

- **Pulsing live broadcast dot**: Visual red/green pulse ring indicating active match broadcast.
- **Formatted numeric count**: Formats counts cleanly (e.g. `0`, `42`, `1.5k`, `1.2M`).
- **Overlapping avatar stack**: Compact stack of spectator avatars with fallback initial letters and `+N` overflow counter.
- **Expandable spectator list**: Interactive popover displaying active spectator usernames.
- **Zero-spectator compact state**: Automatically enters a discreet compact state when no viewers are watching.
- **Accessible announcements**: Implements `role="status"` with live `aria-label` screen reader announcements.

## Installation / Target

```
experimental/ui/match-spectator-count-badge/
```

## Usage

```tsx
import React from 'react';
import { MatchSpectatorCountBadge } from './MatchSpectatorCountBadge';

export const ArenaHeader = () => {
  return (
    <MatchSpectatorCountBadge
      spectatorCount={18}
      spectatorAvatars={['https://example.com/a1.png', 'Alice', 'Bob']}
      spectatorUsernames={['alice_stellar', 'bob_wagerer', 'carol_arcade']}
      isLive={true}
    />
  );
};
```

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `spectatorCount` | `number` | **required** | Total active spectators |
| `spectatorAvatars` | `string[]` | `[]` | URLs or initials for spectator avatars |
| `spectatorUsernames` | `string[]` | `[]` | Usernames for the details popover list |
| `isLive` | `boolean` | `true` | Shows live broadcast pulse indicator |
| `maxAvatars` | `number` | `3` | Max avatars in the mini-stack |
| `className` | `string` | `''` | Extra CSS class names |
| `testId` | `string` | `'match-spectator-count-badge'` | Test identifier |

## Testing

Run unit tests via Vitest:

```bash
vitest run experimental/ui/match-spectator-count-badge/MatchSpectatorCountBadge.test.tsx
```
