# Audio Volume Slider Dock

A compact, floating audio control dock widget for the experimental workspace, allowing players to adjust arcade volume and toggle mute from anywhere in the UI.

## Features

- **Floating dock trigger**: Arcade-styled floating button with animated sound waves when audio is playing, and muted speaker icon when muted.
- **Expandable popover panel**: Clean volume slider panel with click-outside and Escape key dismissal.
- **Accessible volume slider**: Standard range input with `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-valuetext`.
- **Quick mute button**: Instantly mutes or unmutes without losing the previous volume level.
- **Preset buttons**: 1-click jumps for 0%, 25%, 50%, 75%, and 100%.
- **Safe localStorage persistence**: Remembers user volume preference across sessions with graceful error handling.

## Installation / Target

```
experimental/ui/audio-volume-slider-dock/
```

## Usage

```tsx
import React, { useState } from 'react';
import { AudioVolumeSliderDock } from './AudioVolumeSliderDock';

export const ArcadeHUD = () => {
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);

  return (
    <AudioVolumeSliderDock
      initialVolume={volume}
      isMuted={isMuted}
      onVolumeChange={(val) => setVolume(val)}
      onToggleMute={() => setIsMuted((prev) => !prev)}
      position="bottom-right"
    />
  );
};
```

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `initialVolume` | `number` | `75` | Starting volume percentage (0 - 100) |
| `isMuted` | `boolean` | `false` | Current mute status |
| `onVolumeChange` | `(volume: number) => void` | **required** | Callback when volume changes |
| `onToggleMute` | `() => void` | **required** | Callback to toggle audio mute |
| `storageKey` | `string` | `'stellarcade_volume_preference'` | LocalStorage key for volume memory |
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Popover anchoring position |
| `className` | `string` | `''` | Extra CSS class names |
| `testId` | `string` | `'audio-volume-slider-dock'` | Test identifier |

## Testing

Run unit tests via Vitest:

```bash
vitest run experimental/ui/audio-volume-slider-dock/AudioVolumeSliderDock.test.tsx
```
