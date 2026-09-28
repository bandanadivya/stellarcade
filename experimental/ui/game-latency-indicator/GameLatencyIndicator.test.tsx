import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { GameLatencyIndicator } from './GameLatencyIndicator';

describe('GameLatencyIndicator', () => {
  it('excellent latency (<80ms) displays green styling and 4 active bars', () => {
    render(<GameLatencyIndicator latencyMs={45} />);

    const pill = screen.getByTestId('game-latency-indicator-pill');
    expect(pill).toHaveAttribute('data-tier', 'excellent');
    expect(screen.getByTestId('game-latency-indicator-value')).toHaveTextContent(
      '45 ms',
    );

    const bar4 = screen.getByTestId('game-latency-indicator-bar-4');
    expect(bar4).toHaveStyle({ backgroundColor: 'rgb(16, 185, 129)' });

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute(
      'aria-label',
      'Ping: 45ms, Connection: Excellent',
    );
  });

  it('fair latency (80-250ms) displays warning amber styling', () => {
    render(<GameLatencyIndicator latencyMs={150} />);

    const pill = screen.getByTestId('game-latency-indicator-pill');
    expect(pill).toHaveAttribute('data-tier', 'fair');
    expect(screen.getByTestId('game-latency-indicator-value')).toHaveTextContent(
      '150 ms',
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute(
      'aria-label',
      'Ping: 150ms, Connection: Fair',
    );
  });

  it('poor/high latency (>250ms) displays red styling', () => {
    render(<GameLatencyIndicator latencyMs={320} />);

    const pill = screen.getByTestId('game-latency-indicator-pill');
    expect(pill).toHaveAttribute('data-tier', 'poor');
    expect(screen.getByTestId('game-latency-indicator-value')).toHaveTextContent(
      '320 ms',
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute(
      'aria-label',
      'Ping: 320ms, Connection: High Latency',
    );
  });

  it('offline/disconnected state displays offline banner and gray bars', () => {
    render(<GameLatencyIndicator isOffline={true} />);

    const pill = screen.getByTestId('game-latency-indicator-pill');
    expect(pill).toHaveAttribute('data-tier', 'offline');
    expect(screen.getByTestId('game-latency-indicator-value')).toHaveTextContent(
      'Offline',
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', 'Network disconnected');

    // Open popover to verify offline banner
    fireEvent.click(pill);
    expect(
      screen.getByTestId('game-latency-indicator-offline-banner'),
    ).toBeInTheDocument();
  });

  it('clicking manual Re-test Ping button calls onRefresh', async () => {
    const handleRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <GameLatencyIndicator latencyMs={55} onRefresh={handleRefresh} />,
    );

    const pill = screen.getByTestId('game-latency-indicator-pill');
    fireEvent.click(pill);

    const refreshBtn = screen.getByTestId(
      'game-latency-indicator-refresh-button',
    );
    fireEvent.click(refreshBtn);

    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });

  it('displays RPC endpoint and ledger sequence in diagnostics popover', () => {
    render(
      <GameLatencyIndicator
        latencyMs={60}
        rpcNodeUrl="https://rpc.stellar.custom:8000"
        ledgerSequence={123456}
        packetLossPercent={5}
      />,
    );

    const pill = screen.getByTestId('game-latency-indicator-pill');
    fireEvent.click(pill);

    expect(
      screen.getByTestId('game-latency-indicator-rpc-url'),
    ).toHaveTextContent('https://rpc.stellar.custom:8000');
    expect(
      screen.getByTestId('game-latency-indicator-ledger-seq'),
    ).toHaveTextContent('#123456');
    expect(
      screen.getByTestId('game-latency-indicator-packet-loss-warning'),
    ).toHaveTextContent('5% packet loss');
  });
});
