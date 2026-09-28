import React, { useState, useRef, useEffect } from 'react';
import type { MatchSpectatorCountBadgeProps } from './types';

const formatSpectatorCount = (count: number): string => {
  if (count <= 0) return '0';
  if (count >= 1_000_000) {
    const formatted = (count / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${formatted}M`;
  }
  if (count >= 1_000) {
    const formatted = (count / 1_000).toFixed(1).replace(/\.0$/, '');
    return `${formatted}k`;
  }
  return count.toString();
};

const AVATAR_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
];

export const MatchSpectatorCountBadge: React.FC<MatchSpectatorCountBadgeProps> = ({
  spectatorCount,
  spectatorAvatars = [],
  spectatorUsernames = [],
  isLive = true,
  maxAvatars = 3,
  className = '',
  testId = 'match-spectator-count-badge',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isZero = spectatorCount <= 0;
  const showLivePulse = isLive && !isZero;
  const formattedCount = formatSpectatorCount(spectatorCount);

  // Close tooltip on click outside
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

  const displayedAvatars = spectatorAvatars.slice(0, maxAvatars);
  const remainingCount = Math.max(0, spectatorCount - displayedAvatars.length);

  const ariaText = isZero
    ? '0 spectators'
    : `${spectatorCount} ${showLivePulse ? 'live ' : ''}spectator${spectatorCount === 1 ? '' : 's'} watching`;

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      role="status"
      aria-label={ariaText}
      aria-live="polite"
      className={`match-spectator-count-badge ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        userSelect: 'none',
      }}
    >
      <button
        type="button"
        data-testid={`${testId}-trigger`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => {
          if (!isZero) {
            setIsOpen((prev) => !prev);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: isZero ? '4px 10px' : '5px 12px',
          backgroundColor: isZero ? '#0F172A' : '#1E293B',
          border: isZero ? '1px solid #334155' : '1px solid #38BDF8',
          borderRadius: '9999px',
          color: isZero ? '#94A3B8' : '#F8FAFC',
          fontSize: '12px',
          fontWeight: 600,
          cursor: isZero ? 'default' : 'pointer',
          boxShadow: isZero
            ? 'none'
            : '0 2px 8px rgba(56, 189, 248, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
      >
        {/* Pulsing Live Dot Indicator */}
        <div
          data-testid={`${testId}-dot`}
          data-live={showLivePulse}
          style={{
            position: 'relative',
            width: '8px',
            height: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {showLivePulse && (
            <span
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: '#EF4444',
                opacity: 0.75,
                animation: 'pulse 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
              }}
            />
          )}
          <span
            style={{
              position: 'relative',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isZero
                ? '#64748B'
                : showLivePulse
                  ? '#EF4444'
                  : '#10B981',
            }}
          />
        </div>

        {/* Spectator Count Number */}
        <span
          data-testid={`${testId}-count`}
          style={{
            fontFamily: 'monospace, sans-serif',
            letterSpacing: '0.2px',
          }}
        >
          {formattedCount}
        </span>

        {/* Viewers label */}
        <span style={{ color: '#94A3B8', fontSize: '11px' }}>
          {isZero ? 'viewers' : spectatorCount === 1 ? 'viewer' : 'viewers'}
        </span>

        {/* Avatar Stack (only shown when spectators > 0 and avatars provided) */}
        {!isZero && displayedAvatars.length > 0 && (
          <div
            data-testid={`${testId}-avatar-stack`}
            style={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: '4px',
            }}
          >
            {displayedAvatars.map((avatar, idx) => (
              <div
                key={idx}
                data-testid={`${testId}-avatar-${idx}`}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  marginLeft: idx === 0 ? '0' : '-6px',
                  border: '1.5px solid #1E293B',
                  overflow: 'hidden',
                  backgroundColor:
                    AVATAR_COLORS[idx % AVATAR_COLORS.length],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: '9px',
                  fontWeight: 700,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}
              >
                {avatar.startsWith('http') || avatar.startsWith('/') ? (
                  <img
                    src={avatar}
                    alt={`Spectator ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>{avatar.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
            ))}

            {remainingCount > 0 && (
              <div
                data-testid={`${testId}-avatar-remainder`}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  marginLeft: '-6px',
                  border: '1.5px solid #1E293B',
                  backgroundColor: '#334155',
                  color: '#CBD5E1',
                  fontSize: '8px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                +{remainingCount}
              </div>
            )}
          </div>
        )}
      </button>

      {/* Expandable Tooltip / Usernames List Popover */}
      {isOpen && (
        <div
          data-testid={`${testId}-tooltip`}
          role="dialog"
          aria-label="Active spectators list"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 50,
            minWidth: '180px',
            backgroundColor: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
              paddingBottom: '4px',
              borderBottom: '1px solid #1E293B',
            }}
          >
            Spectators ({spectatorCount})
          </div>

          {spectatorUsernames.length > 0 ? (
            <ul
              data-testid={`${testId}-user-list`}
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                maxHeight: '140px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {spectatorUsernames.map((username, idx) => (
                <li
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: '#E2E8F0',
                    padding: '2px 4px',
                    borderRadius: '4px',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#10B981',
                    }}
                  />
                  <span>{username}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ fontSize: '11px', color: '#64748B' }}>
              Spectators watching arena duel
            </div>
          )}
        </div>
      )}
    </div>
  );
};
