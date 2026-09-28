# Activity Radar

A circular scanning radar canvas component displaying real-time match pings and player activity on a futuristic sweep radar. Built for the experimental workspace to visualize active matches with radiating blips, a rotating sweep line, and ping details.

## Features

- **Circular canvas radar screen** with animated rotating scanline beam
- **Radiating blip dots** that fade over time representing match initiation events
- **Ping coordinates** mapped to simulated global cluster regions (0-100 normalized scale)
- **Active match count counter** showing real-time player activity
- **Matches-per-minute gauge** tracking match initiation frequency
- **Clickable blips** with tooltip displaying game name and wager size
- **Battery/CPU conservation** — pauses canvas loop when tab is hidden
- **Fully self-contained** — isolated to `experimental/ui/active-players-globe/`
- **Accessible** — semantic HTML with ARIA labels and keyboard support

## Installation

```bash
cp -r experimental/ui/active-players-globe /path/to/your/components/
```

## Usage

```tsx
import { ActivityRadar } from './active-players-globe/ActivityRadar';
import { ActivityPing } from './active-players-globe/types';

function WorkspaceMonitor() {
  const [pings, setPings] = React.useState<ActivityPing[]>([]);

  React.useEffect(() => {
    // Listen to real-time match pings
    const unsubscribe = matchService.onNewMatch((match) => {
      setPings((prev) => [
        ...prev,
        {
          id: match.id,
          x: Math.random() * 100, // 0-100 normalized coordinate
          y: Math.random() * 100,
          gameName: match.game,
          wagerSize: match.wager,
          timestamp: Date.now(),
        },
      ]);
    });

    return unsubscribe;
  }, []);

  const handleSelectPing = (ping: ActivityPing) => {
    console.log(`Selected match: ${ping.gameName}, Wager: $${ping.wagerSize}`);
  };

  return (
    <ActivityRadar
      pings={pings}
      scanSpeedMs={4000}
      onSelectPing={handleSelectPing}
    />
  );
}
```

## Props

| Prop            | Type                     | Default                    | Description                              |
|-----------------|--------------------------|----------------------------|------------------------------------------|
| `pings`         | `ActivityPing[]`         | required                   | Array of active match pings              |
| `scanSpeedMs`   | `number`                 | `4000`                     | Sweep rotation speed in milliseconds     |
| `onSelectPing`  | `(ping: ActivityPing) => void` | undefined            | Callback when a blip is clicked          |
| `className`     | `string`                 | `''`                       | Extra class names                        |
| `testId`        | `string`                 | `'activity-radar'`         | Root test id                             |

## ActivityPing Interface

```typescript
interface ActivityPing {
  id: string;                    // Unique identifier
  x: number;                     // 0-100, normalized x coordinate
  y: number;                     // 0-100, normalized y coordinate
  gameName: string;              // Name of the game
  wagerSize: number;             // Wager amount in currency units
  timestamp: number;             // Milliseconds since creation
}
```

## Radar Visualization

### Grid System
- **Concentric circles** represent distance rings on the radar
- **Crosshair lines** divide the space into quadrants
- **Sweep line** rotates at configurable speed, scanning all regions

### Blip Lifecycle
1. **Appearance**: New pings render as bright white cores with pink/magenta glow
2. **Fade**: Blips gradually fade over 3 seconds (configurable via `BLIP_FADE_DURATION`)
3. **Removal**: Faded blips are cleared from the canvas

### Color Scheme
- **Grid**: Cyan/light blue (0, 200, 255)
- **Sweep**: Green (0, 255, 150)
- **Blips**: Magenta/pink core with white center
- **Background**: Dark blue gradient

## Statistics Display

The component displays two key metrics below the radar:

- **Active Matches**: Current number of visible pings on the radar
- **Matches/Min**: Running count of new pings initiated in the last 60 seconds

## Accessibility

- The radar canvas has `role="img"` with descriptive `aria-label`
- All interactive elements are keyboard accessible
- Color scheme respects `prefers-reduced-motion`
- Stats section uses semantic HTML with clear labels

## Testing

```bash
npx vitest run experimental/ui/active-players-globe/ActivityRadar.test.tsx
```

### Test Coverage

- ✅ Canvas mounts and render loop starts
- ✅ Active ping count renders accurately
- ✅ Clicking blip fires `onSelectPing` callback
- ✅ Stats update correctly with new pings
- ✅ Canvas pauses when tab is hidden (battery/CPU conservation)
- ✅ Custom props accepted and applied
- ✅ No core platform files modified

## Performance Considerations

- **Canvas optimization**: Uses `requestAnimationFrame` for smooth 60 FPS rendering
- **Visibility detection**: Automatically pauses rendering when tab is inactive
- **Efficient blip management**: Old/faded blips are removed after `BLIP_FADE_DURATION`
- **Memory-conscious**: Tracks only active pings; cleanup is automatic

## Browser Support

- Modern browsers with HTML5 Canvas support
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Requires `requestAnimationFrame` support

## Notes

- This component is **purely presentational** and does not modify any core platform state
- All styles are scoped to `.activity-radar` to avoid conflicts
- The radar uses normalized coordinates (0-100) for flexibility in coordinate mapping
- Designed for real-time data streaming; efficiently handles frequent ping updates
