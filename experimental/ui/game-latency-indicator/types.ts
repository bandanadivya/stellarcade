export type LatencyTier = 'excellent' | 'fair' | 'poor' | 'offline';

export interface GameLatencyIndicatorProps {
  /**
   * Round-trip latency in milliseconds.
   * If undefined and not simulated, considered offline/disconnected.
   */
  latencyMs?: number;

  /**
   * Connected Stellar Horizon/RPC Node URL.
   * Defaults to 'https://horizon-testnet.stellar.org'.
   */
  rpcNodeUrl?: string;

  /**
   * Current validated ledger sequence number.
   */
  ledgerSequence?: number;

  /**
   * Block production latency in milliseconds.
   */
  blockLatencyMs?: number;

  /**
   * Packet loss percentage (0 - 100).
   */
  packetLossPercent?: number;

  /**
   * Whether the indicator should actively poll or simulate live latency.
   * Defaults to false.
   */
  isLive?: boolean;

  /**
   * Explicit offline/disconnected flag.
   */
  isOffline?: boolean;

  /**
   * Auto-poll interval in milliseconds when isLive is true.
   * Defaults to 5000ms.
   */
  pollIntervalMs?: number;

  /**
   * Callback fired when manual 'Re-test Ping' button is clicked.
   */
  onRefresh?: () => Promise<void> | void;

  /**
   * Optional custom CSS class names.
   */
  className?: string;

  /**
   * Optional custom test identifier.
   */
  testId?: string;
}
