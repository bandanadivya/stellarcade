# Game Latency Ping Indicator

A lightweight network latency indicator component for the experimental workspace to display live RPC response times, node connection quality, and packet loss warnings before players place wagers.

## Features

- **Color-coded latency thresholds**:
  - Green (< 80ms, Excellent)
  - Amber (80ms - 250ms, Fair)
  - Red (> 250ms, Poor / High Latency)
  - Gray (Offline / Disconnected)
- **Signal strength bars**: Visual 4-bar indicator corresponding to connection quality tier.
- **Diagnostic details popover**: Displays RPC endpoint URL, ledger sequence number, and block latency.
- **Packet loss warning**: Displays alert banner when packet loss is detected.
- **Offline banner**: Alert warning when node is disconnected.
- **Manual 'Re-test Ping'**: Interactive button triggering ping re-evaluation with loading feedback.
- **Accessible status announcements**: Screen-reader friendly `role="status"` with live aria labels.

## Installation / Target

```
experimental/ui/game-latency-indicator/
```

## Usage

```tsx
import React, { useState } from 'react';
import { GameLatencyIndicator } from './GameLatencyIndicator';

export const ArenaStatusHeader = () => {
  const [latency, setLatency] = useState(42);

  const checkPing = async () => {
    const start = performance.now();
    await fetch('https://horizon-testnet.stellar.org/healthz');
    setLatency(Math.round(performance.now() - start));
  };

  return (
    <GameLatencyIndicator
      latencyMs={latency}
      rpcNodeUrl="https://horizon-testnet.stellar.org"
      ledgerSequence={1059283}
      blockLatencyMs={120}
      onRefresh={checkPing}
    />
  );
};
```

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `latencyMs` | `number` | `undefined` | Round-trip latency in milliseconds |
| `rpcNodeUrl` | `string` | `'https://horizon-testnet.stellar.org'` | RPC endpoint URL |
| `ledgerSequence` | `number` | `undefined` | Latest validated ledger sequence |
| `blockLatencyMs` | `number` | `undefined` | Block production latency in ms |
| `packetLossPercent` | `number` | `0` | Packet loss percentage |
| `isLive` | `boolean` | `false` | Enable periodic ping polling |
| `isOffline` | `boolean` | `false` | Disconnected state override |
| `pollIntervalMs` | `number` | `5000` | Auto-polling interval in ms |
| `onRefresh` | `() => Promise<void> \| void` | `undefined` | Callback for manual re-test |
| `className` | `string` | `''` | Extra CSS class names |
| `testId` | `string` | `'game-latency-indicator'` | Root test identifier |

## Testing

Run unit tests via Vitest:

```bash
vitest run experimental/ui/game-latency-indicator/GameLatencyIndicator.test.tsx
```
