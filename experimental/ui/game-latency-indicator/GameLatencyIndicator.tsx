import React, { useState, useEffect, useRef } from 'react';
import type { GameLatencyIndicatorProps, LatencyTier } from './types';

const getLatencyTier = (
  latencyMs: number | undefined,
  isOffline: boolean,
): LatencyTier => {
  if (isOffline || latencyMs === undefined || latencyMs < 0) {
    return 'offline';
  }
  if (latencyMs < 80) {
    return 'excellent';
  }
  if (latencyMs <= 250) {
    return 'fair';
  }
  return 'poor';
};

const TIER_CONFIG = {
  excellent: {
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#059669',
    label: 'Excellent',
    activeBars: 4,
  },
  fair: {
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#D97706',
    label: 'Fair',
    activeBars: 2,
  },
  poor: {
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#DC2626',
    label: 'High Latency',
    activeBars: 1,
  },
  offline: {
    color: '#94A3B8',
    bgColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: '#475569',
    label: 'Disconnected',
    activeBars: 0,
  },
};

export const GameLatencyIndicator: React.FC<GameLatencyIndicatorProps> = ({
  latencyMs,
  rpcNodeUrl = 'https://horizon-testnet.stellar.org',
  ledgerSequence,
  blockLatencyMs,
  packetLossPercent = 0,
  isLive = false,
  isOffline = false,
  pollIntervalMs = 5000,
  onRefresh,
  className = '',
  testId = 'game-latency-indicator',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const tier = getLatencyTier(latencyMs, isOffline);
  const config = TIER_CONFIG[tier];

  // Click outside to dismiss popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Live polling effect
  useEffect(() => {
    if (!isLive || isOffline || !onRefresh) return;

    const interval = setInterval(() => {
      onRefresh();
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [isLive, isOffline, pollIntervalMs, onRefresh]);

  const handleManualRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const statusText =
    tier === 'offline'
      ? 'Network disconnected'
      : `Ping: ${latencyMs}ms, Connection: ${config.label}`;

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      role="status"
      aria-label={statusText}
      aria-live="polite"
      className={`game-latency-indicator ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        userSelect: 'none',
      }}
    >
      {/* Latency Pill Trigger */}
      <button
        type="button"
        data-testid={`${testId}-pill`}
        data-tier={tier}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsOpen(false);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 10px',
          borderRadius: '9999px',
          backgroundColor: '#0F172A',
          border: `1.5px solid ${config.borderColor}`,
          color: config.color,
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: 'monospace, sans-serif',
          cursor: 'pointer',
          boxShadow: `0 2px 8px ${config.bgColor}, inset 0 1px 0 rgba(255, 255, 255, 0.08)`,
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
      >
        {/* Signal Bars Indicator */}
        <div
          data-testid={`${testId}-signal-bars`}
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '2px',
            height: '12px',
          }}
        >
          {[1, 2, 3, 4].map((barNum) => {
            const isBarActive = barNum <= config.activeBars;
            const barHeight = barNum * 3; // 3px, 6px, 9px, 12px
            return (
              <span
                key={barNum}
                data-testid={`${testId}-bar-${barNum}`}
                style={{
                  width: '3px',
                  height: `${barHeight}px`,
                  borderRadius: '1px',
                  backgroundColor: isBarActive ? config.color : '#334155',
                  transition: 'background-color 0.2s ease',
                }}
              />
            );
          })}
        </div>

        {/* Latency / Disconnect Value */}
        <span data-testid={`${testId}-value`}>
          {tier === 'offline' ? 'Offline' : `${latencyMs} ms`}
        </span>
      </button>

      {/* Expandable Diagnostic Popover */}
      {isOpen && (
        <div
          data-testid={`${testId}-popover`}
          role="dialog"
          aria-label="Network diagnostics"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 60,
            width: '260px',
            backgroundColor: '#0F172A',
            border: '1px solid #1E293B',
            borderRadius: '10px',
            padding: '14px',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.6), 0 0 12px rgba(56, 189, 248, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            fontSize: '12px',
          }}
        >
          {/* Popover Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #1E293B',
              paddingBottom: '8px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#94A3B8',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Network Health
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: config.color,
                backgroundColor: config.bgColor,
                padding: '2px 6px',
                borderRadius: '4px',
                border: `1px solid ${config.borderColor}`,
              }}
            >
              {config.label}
            </span>
          </div>

          {/* Offline Warning Banner */}
          {tier === 'offline' && (
            <div
              data-testid={`${testId}-offline-banner`}
              style={{
                padding: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #EF4444',
                borderRadius: '6px',
                color: '#FCA5A5',
                fontSize: '11px',
                lineHeight: 1.4,
              }}
            >
              Node disconnected. Wager submission and duel synchronization may fail.
            </div>
          )}

          {/* Packet Loss Warning */}
          {packetLossPercent > 0 && tier !== 'offline' && (
            <div
              data-testid={`${testId}-packet-loss-warning`}
              style={{
                padding: '6px 8px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid #F59E0B',
                borderRadius: '6px',
                color: '#FCD34D',
                fontSize: '11px',
              }}
            >
              Warning: {packetLossPercent}% packet loss detected
            </div>
          )}

          {/* Network Metrics List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              color: '#CBD5E1',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>RPC Endpoint:</span>
              <span
                data-testid={`${testId}-rpc-url`}
                style={{
                  fontFamily: 'monospace',
                  maxWidth: '140px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={rpcNodeUrl}
              >
                {rpcNodeUrl}
              </span>
            </div>

            {ledgerSequence !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Ledger Sequence:</span>
                <span
                  data-testid={`${testId}-ledger-seq`}
                  style={{ fontFamily: 'monospace', color: '#38BDF8' }}
                >
                  #{ledgerSequence}
                </span>
              </div>
            )}

            {blockLatencyMs !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Block Latency:</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {blockLatencyMs} ms
                </span>
              </div>
            )}
          </div>

          {/* Re-test Ping Manual Button */}
          {onRefresh && (
            <button
              type="button"
              data-testid={`${testId}-refresh-button`}
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              style={{
                width: '100%',
                marginTop: '4px',
                padding: '6px 0',
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#38BDF8',
                fontSize: '11px',
                fontWeight: 600,
                cursor: isRefreshing ? 'wait' : 'pointer',
                opacity: isRefreshing ? 0.6 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              {isRefreshing ? 'Testing Ping...' : 'Re-test Ping'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
