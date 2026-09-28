export type MatchStatus = 'Upcoming' | 'In Progress' | 'Settled' | 'Forfeited';

export interface TournamentPlayer {
  id: string;
  username: string;
  address?: string;
  avatarUrl?: string;
  winRate?: number; // e.g. 68 for 68%
  isWinner?: boolean;
}

export interface TournamentMatchData {
  id: string;
  player1: TournamentPlayer;
  player2?: TournamentPlayer | null;
  prizePoolXlm: number;
  status: MatchStatus;
  winnerId?: string;
  startTime?: string | number;
  countdownText?: string;
  roundName?: string;
}

export interface TournamentMatchCardProps {
  match: TournamentMatchData;
  onActionClick?: (matchId: string) => void;
  actionLabel?: string;
  className?: string;
}
