import React from 'react';
import { TournamentMatchCardProps, TournamentPlayer } from './types';
import './TournamentMatchCard.css';

export function formatAddress(address?: string): string {
  if (!address) return '—';
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function formatWinRate(winRate?: number): string {
  if (winRate === undefined || winRate === null || Number.isNaN(winRate)) return 'N/A';
  return `${Math.round(winRate)}% Win`;
}

export function getDefaultActionLabel(status: string): string {
  switch (status) {
    case 'Upcoming':
      return 'Play Match';
    case 'In Progress':
      return 'Spectate Match';
    case 'Settled':
      return 'View Results';
    case 'Forfeited':
      return 'Match Details';
    default:
      return 'View Match';
  }
}

export const TournamentMatchCard: React.FC<TournamentMatchCardProps> = ({
  match,
  onActionClick,
  actionLabel,
  className = '',
}) => {
  const { id, player1, player2, prizePoolXlm, status, winnerId, roundName, countdownText } = match;

  const isPlayerWinner = (player?: TournamentPlayer | null): boolean => {
    if (!player || status !== 'Settled') return false;
    if (player.isWinner) return true;
    if (winnerId && player.id === winnerId) return true;
    return false;
  };

  const statusClass = `tournament-status-${status.toLowerCase().replace(/\s+/g, '-')}`;
  const effectiveActionLabel = actionLabel || getDefaultActionLabel(status);

  const renderPlayer = (player: TournamentPlayer | null | undefined, isOpponent = false) => {
    const isWinner = isPlayerWinner(player);
    const isMissing = !player;
    const displayName = player?.username || (isOpponent ? 'Awaiting Opponent' : 'Anonymous Player');
    const displayAddress = formatAddress(player?.address);
    const displayWinRate = formatWinRate(player?.winRate);

    return (
      <div
        className={`tournament-player-card ${isWinner ? 'is-winner' : ''} ${
          isMissing ? 'is-opponent-missing' : ''
        }`}
        data-testid={isOpponent ? 'player2-card' : 'player1-card'}
      >
        {isWinner && <div className="tournament-winner-ribbon">Winner</div>}
        <div className="tournament-player-avatar-wrapper">
          {player?.avatarUrl ? (
            <img
              src={player.avatarUrl}
              alt={`${displayName}'s avatar`}
              className="tournament-player-avatar"
            />
          ) : (
            <div className="tournament-player-avatar-fallback" aria-label="Avatar placeholder">
              {isMissing ? '?' : displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="tournament-player-name" title={displayName}>
          {displayName}
        </div>
        <div className="tournament-player-address">{displayAddress}</div>
        <div className="tournament-player-stat">{displayWinRate}</div>
      </div>
    );
  };

  return (
    <div
      className={`tournament-match-card ${className}`.trim()}
      data-testid={`tournament-match-${id}`}
    >
      <div className="tournament-match-header">
        <span className="tournament-round-badge">{roundName || 'Championship Match'}</span>
        <span className={`tournament-status-badge ${statusClass}`}>{status}</span>
      </div>

      <div className="tournament-players-wrapper">
        {renderPlayer(player1, false)}

        <div className="tournament-vs-divider">
          <span className="tournament-vs-badge" aria-label="versus">
            VS
          </span>
        </div>

        {renderPlayer(player2, true)}
      </div>

      <div className="tournament-match-footer">
        <div className="tournament-prize-pool">
          <span className="tournament-prize-label">Prize Pool</span>
          <span className="tournament-prize-value">
            {prizePoolXlm.toLocaleString()} XLM
          </span>
          {countdownText && <span className="tournament-countdown">{countdownText}</span>}
        </div>

        <button
          type="button"
          className="tournament-action-btn"
          onClick={() => onActionClick?.(id)}
          aria-label={`${effectiveActionLabel} for match ${id}`}
        >
          {effectiveActionLabel}
        </button>
      </div>
    </div>
  );
};
