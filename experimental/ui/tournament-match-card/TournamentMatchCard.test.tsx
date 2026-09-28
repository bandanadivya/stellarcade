import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});
import {
  TournamentMatchCard,
  formatAddress,
  formatWinRate,
  getDefaultActionLabel,
} from './TournamentMatchCard';
import { TournamentMatchData } from './types';

describe('TournamentMatchCard', () => {
  const baseMatch: TournamentMatchData = {
    id: 'match-101',
    player1: {
      id: 'p1',
      username: 'StellarKing',
      address: 'GDZX4KPW2N3DAB76R74L6ZXYY5ZMQZ4K6G653M5LQPXQ3Q9876543210',
      winRate: 72,
    },
    player2: {
      id: 'p2',
      username: 'ArcadeQueen',
      address: 'GB74L6ZXYY5ZMQZ4K6G653M5LQPXQ3QGDZX4KPW2N3DAB76R0123456789',
      winRate: 65,
    },
    prizePoolXlm: 2500,
    status: 'Upcoming',
    roundName: 'Quarter-Finals',
  };

  it('displays both player usernames and the VS divider', () => {
    render(<TournamentMatchCard match={baseMatch} />);

    expect(screen.getByText('StellarKing')).toBeInTheDocument();
    expect(screen.getByText('ArcadeQueen')).toBeInTheDocument();
    expect(screen.getByText('VS')).toBeInTheDocument();
    expect(screen.getByText('Quarter-Finals')).toBeInTheDocument();
    expect(screen.getByText('2,500 XLM')).toBeInTheDocument();
  });

  it('highlights the winner when match is settled', () => {
    const settledMatch: TournamentMatchData = {
      ...baseMatch,
      status: 'Settled',
      winnerId: 'p1',
    };

    render(<TournamentMatchCard match={settledMatch} />);

    const p1Card = screen.getByTestId('player1-card');
    const p2Card = screen.getByTestId('player2-card');

    expect(p1Card).toHaveClass('is-winner');
    expect(p2Card).not.toHaveClass('is-winner');
    expect(screen.getByText('Winner')).toBeInTheDocument();
  });

  it('settled match works with player isWinner boolean flag', () => {
    const settledMatch: TournamentMatchData = {
      ...baseMatch,
      status: 'Settled',
      player1: { ...baseMatch.player1, isWinner: false },
      player2: { ...baseMatch.player2!, isWinner: true },
    };

    render(<TournamentMatchCard match={settledMatch} />);

    const p2Card = screen.getByTestId('player2-card');
    expect(p2Card).toHaveClass('is-winner');
  });

  it('triggers onActionClick callback with matchId when action button is clicked', () => {
    const handleActionClick = vi.fn();
    render(<TournamentMatchCard match={baseMatch} onActionClick={handleActionClick} />);

    const button = screen.getByRole('button', { name: /Play Match/i });
    fireEvent.click(button);

    expect(handleActionClick).toHaveBeenCalledTimes(1);
    expect(handleActionClick).toHaveBeenCalledWith('match-101');
  });

  it('handles missing or anonymous opponent gracefully', () => {
    const soloMatch: TournamentMatchData = {
      ...baseMatch,
      player2: null,
    };

    render(<TournamentMatchCard match={soloMatch} />);

    expect(screen.getByText('StellarKing')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Opponent')).toBeInTheDocument();

    const p2Card = screen.getByTestId('player2-card');
    expect(p2Card).toHaveClass('is-opponent-missing');
  });

  it('renders different status badges correctly', () => {
    const { rerender } = render(<TournamentMatchCard match={baseMatch} />);
    expect(screen.getByText('Upcoming')).toHaveClass('tournament-status-upcoming');

    rerender(<TournamentMatchCard match={{ ...baseMatch, status: 'In Progress' }} />);
    expect(screen.getByText('In Progress')).toHaveClass('tournament-status-in-progress');

    rerender(<TournamentMatchCard match={{ ...baseMatch, status: 'Forfeited' }} />);
    expect(screen.getByText('Forfeited')).toHaveClass('tournament-status-forfeited');
  });

  it('displays countdown text when provided', () => {
    render(
      <TournamentMatchCard
        match={{ ...baseMatch, countdownText: 'Starts in 12m 45s' }}
      />
    );
    expect(screen.getByText('Starts in 12m 45s')).toBeInTheDocument();
  });

  describe('helper functions', () => {
    it('formatAddress truncates correctly', () => {
      expect(formatAddress('GDZX4KPW2N3DAB76R74L6ZXYY5ZMQZ4K6G653M5LQPXQ3Q9876543210')).toBe(
        'GDZX...3210'
      );
      expect(formatAddress('GABC1234')).toBe('GABC1234');
      expect(formatAddress(undefined)).toBe('—');
    });

    it('formatWinRate formats correctly', () => {
      expect(formatWinRate(68.4)).toBe('68% Win');
      expect(formatWinRate(undefined)).toBe('N/A');
    });

    it('getDefaultActionLabel returns appropriate labels', () => {
      expect(getDefaultActionLabel('Upcoming')).toBe('Play Match');
      expect(getDefaultActionLabel('In Progress')).toBe('Spectate Match');
      expect(getDefaultActionLabel('Settled')).toBe('View Results');
      expect(getDefaultActionLabel('Forfeited')).toBe('Match Details');
    });
  });
});
