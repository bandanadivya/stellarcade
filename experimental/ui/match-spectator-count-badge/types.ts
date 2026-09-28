export interface MatchSpectatorCountBadgeProps {
  /**
   * Total number of spectators currently watching the match.
   */
  spectatorCount: number;

  /**
   * Optional array of spectator avatar image URLs or initials.
   */
  spectatorAvatars?: string[];

  /**
   * Optional array of spectator usernames for the expandable tooltip/list.
   */
  spectatorUsernames?: string[];

  /**
   * Whether the match is currently live and broadcasting.
   * Defaults to true when spectatorCount > 0.
   */
  isLive?: boolean;

  /**
   * Maximum number of avatars to display in the mini-stack.
   * Defaults to 3.
   */
  maxAvatars?: number;

  /**
   * Optional custom CSS class names.
   */
  className?: string;

  /**
   * Optional custom test ID.
   */
  testId?: string;
}
