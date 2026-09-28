import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});
import {
  GuildLeaderboardBanner,
  getRankBadgeLabel,
  getInitials,
} from './GuildLeaderboardBanner';
import { GuildLeaderboardEntry } from './types';

describe('GuildLeaderboardBanner', () => {
  const mockGuilds: GuildLeaderboardEntry[] = [
    {
      id: 'guild-1',
      name: 'Stellar Dragons',
      tag: '[DRGN]',
      memberCount: 50,
      winRate: 82.4,
      seasonalVolumeXlm: 245000,
      rank: 1,
    },
    {
      id: 'guild-2',
      name: 'Cyber Raiders',
      tag: '[CYBR]',
      memberCount: 42,
      winRate: 75.1,
      seasonalVolumeXlm: 180000,
      rank: 2,
    },
    {
      id: 'guild-3',
      name: 'Void Walkers',
      tag: '[VOID]',
      crestUrl: 'https://example.com/void-crest.png',
      memberCount: 38,
      winRate: 69.8,
      seasonalVolumeXlm: 120000,
      rank: 3,
    },
  ];

  it('renders podium and highlights 1st place with gold class', () => {
    render(<GuildLeaderboardBanner guilds={mockGuilds} />);

    const firstCard = screen.getByTestId('guild-card-guild-1');
    const secondCard = screen.getByTestId('guild-card-guild-2');
    const thirdCard = screen.getByTestId('guild-card-guild-3');

    expect(firstCard).toHaveClass('rank-1');
    expect(secondCard).toHaveClass('rank-2');
    expect(thirdCard).toHaveClass('rank-3');

    expect(screen.getByText('1ST PLACE')).toBeInTheDocument();
    expect(screen.getByText('2ND PLACE')).toBeInTheDocument();
    expect(screen.getByText('3RD PLACE')).toBeInTheDocument();
  });

  it('renders guild statistics correctly', () => {
    render(<GuildLeaderboardBanner guilds={mockGuilds} />);

    expect(screen.getByText('Stellar Dragons')).toBeInTheDocument();
    expect(screen.getByText('[DRGN]')).toBeInTheDocument();
    expect(screen.getByText('245,000 XLM')).toBeInTheDocument();
    expect(screen.getByText('82.4%')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('passes guild ID when join button is clicked', () => {
    const handleJoin = vi.fn();
    render(<GuildLeaderboardBanner guilds={mockGuilds} onJoinGuild={handleJoin} />);

    const joinButtons = screen.getAllByRole('button', { name: /Join Clan/i });
    fireEvent.click(joinButtons[0]);

    expect(handleJoin).toHaveBeenCalledTimes(1);
    expect(handleJoin).toHaveBeenCalledWith('guild-1');
  });

  it('renders empty state when guilds array is empty', () => {
    render(<GuildLeaderboardBanner guilds={[]} seasonLabel="Season 2: Nova Wars" />);

    expect(screen.getByTestId('guild-empty-state')).toBeInTheDocument();
    expect(screen.getByText('Season Leaderboard Pending')).toBeInTheDocument();
    expect(screen.getByTestId('season-label')).toHaveTextContent('Season 2: Nova Wars');
    expect(screen.queryByTestId('guild-podium')).not.toBeInTheDocument();
  });

  it('renders crest avatar image or initials fallback', () => {
    render(<GuildLeaderboardBanner guilds={mockGuilds} />);

    // Guild 1 and 2 don't have crestUrl, should have fallback initials
    expect(screen.getByTestId('guild-crest-fallback-guild-1')).toHaveTextContent('SD');
    expect(screen.getByTestId('guild-crest-fallback-guild-2')).toHaveTextContent('CR');

    // Guild 3 has crestUrl
    const crestImg = screen.getByAltText('Void Walkers crest');
    expect(crestImg).toHaveAttribute('src', 'https://example.com/void-crest.png');
  });

  describe('helper functions', () => {
    it('getRankBadgeLabel returns appropriate label', () => {
      expect(getRankBadgeLabel(1)).toBe('1ST PLACE');
      expect(getRankBadgeLabel(2)).toBe('2ND PLACE');
      expect(getRankBadgeLabel(3)).toBe('3RD PLACE');
      expect(getRankBadgeLabel(4)).toBe('#4');
    });

    it('getInitials extracts initials accurately', () => {
      expect(getInitials('Stellar Dragons')).toBe('SD');
      expect(getInitials('Raiders')).toBe('RA');
      expect(getInitials('')).toBe('??');
    });
  });
});
