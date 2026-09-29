import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MatchSpectatorCountBadge } from './MatchSpectatorCountBadge';

describe('MatchSpectatorCountBadge', () => {
  it('renders default compact zero state when zero spectators', () => {
    render(<MatchSpectatorCountBadge spectatorCount={0} isLive={true} />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-label', '0 spectators');

    const count = screen.getByTestId('match-spectator-count-badge-count');
    expect(count).toHaveTextContent('0');

    // Dot should not be in pulsing live mode
    const dot = screen.getByTestId('match-spectator-count-badge-dot');
    expect(dot).toHaveAttribute('data-live', 'false');

    // Avatar stack should not be rendered
    expect(
      screen.queryByTestId('match-spectator-count-badge-avatar-stack'),
    ).not.toBeInTheDocument();
  });

  it('displays pulsing dot indicator in live state', () => {
    render(<MatchSpectatorCountBadge spectatorCount={12} isLive={true} />);

    const dot = screen.getByTestId('match-spectator-count-badge-dot');
    expect(dot).toHaveAttribute('data-live', 'true');

    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute(
      'aria-label',
      '12 live spectators watching',
    );
  });

  it('renders avatar stack with the correct number of icons', () => {
    const avatars = ['Alice', 'Bob', 'Charlie'];

    render(
      <MatchSpectatorCountBadge
        spectatorCount={3}
        spectatorAvatars={avatars}
        isLive={true}
      />,
    );

    const avatarStack = screen.getByTestId(
      'match-spectator-count-badge-avatar-stack',
    );
    expect(avatarStack).toBeInTheDocument();

    expect(
      screen.getByTestId('match-spectator-count-badge-avatar-0'),
    ).toHaveTextContent('A');
    expect(
      screen.getByTestId('match-spectator-count-badge-avatar-1'),
    ).toHaveTextContent('B');
    expect(
      screen.getByTestId('match-spectator-count-badge-avatar-2'),
    ).toHaveTextContent('C');

    // No remainder badge since count equals avatars length
    expect(
      screen.queryByTestId('match-spectator-count-badge-avatar-remainder'),
    ).not.toBeInTheDocument();
  });

  it('renders remainder badge when spectator count exceeds max displayed avatars', () => {
    const avatars = ['Alice', 'Bob', 'Charlie', 'Dave'];

    render(
      <MatchSpectatorCountBadge
        spectatorCount={25}
        spectatorAvatars={avatars}
        maxAvatars={3}
        isLive={true}
      />,
    );

    // Only 3 avatars shown
    expect(
      screen.getByTestId('match-spectator-count-badge-avatar-0'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('match-spectator-count-badge-avatar-1'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('match-spectator-count-badge-avatar-2'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('match-spectator-count-badge-avatar-3'),
    ).not.toBeInTheDocument();

    // Remainder should show +22 (25 - 3)
    const remainder = screen.getByTestId(
      'match-spectator-count-badge-avatar-remainder',
    );
    expect(remainder).toHaveTextContent('+22');
  });

  it('formats large viewer counts smoothly', () => {
    const { rerender } = render(
      <MatchSpectatorCountBadge spectatorCount={1450} isLive={true} />,
    );

    expect(
      screen.getByTestId('match-spectator-count-badge-count'),
    ).toHaveTextContent('1.5k');

    rerender(
      <MatchSpectatorCountBadge spectatorCount={1200000} isLive={true} />,
    );

    expect(
      screen.getByTestId('match-spectator-count-badge-count'),
    ).toHaveTextContent('1.2M');
  });

  it('opens and closes expandable tooltip with usernames list on trigger click', () => {
    const usernames = ['stellar_knight', 'crypto_duelist', 'horizon_watcher'];

    render(
      <MatchSpectatorCountBadge
        spectatorCount={3}
        spectatorUsernames={usernames}
        isLive={true}
      />,
    );

    const trigger = screen.getByTestId('match-spectator-count-badge-trigger');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Click to open
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const tooltip = screen.getByTestId('match-spectator-count-badge-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(screen.getByText('stellar_knight')).toBeInTheDocument();
    expect(screen.getByText('crypto_duelist')).toBeInTheDocument();
    expect(screen.getByText('horizon_watcher')).toBeInTheDocument();

    // Click to close
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByTestId('match-spectator-count-badge-tooltip'),
    ).not.toBeInTheDocument();
  });
});
