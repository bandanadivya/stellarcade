import React from 'react';
import { GuildLeaderboardBannerProps, GuildLeaderboardEntry } from './types';
import './GuildLeaderboardBanner.css';

export function getRankBadgeLabel(rank: number): string {
  switch (rank) {
    case 1:
      return '1ST PLACE';
    case 2:
      return '2ND PLACE';
    case 3:
      return '3RD PLACE';
    default:
      return `#${rank}`;
  }
}

export function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export const GuildLeaderboardBanner: React.FC<GuildLeaderboardBannerProps> = ({
  guilds = [],
  seasonLabel = 'Season 1: Galactic Showdown',
  onJoinGuild,
  className = '',
}) => {
  const hasGuilds = guilds && guilds.length > 0;

  // Take top 3 guilds and assign ranks if not explicitly set
  const topGuilds = hasGuilds
    ? guilds
        .slice()
        .sort((a, b) => {
          if (a.rank && b.rank) return a.rank - b.rank;
          return b.seasonalVolumeXlm - a.seasonalVolumeXlm;
        })
        .slice(0, 3)
        .map((guild, index) => ({
          ...guild,
          rank: guild.rank || index + 1,
        }))
    : [];

  return (
    <div
      className={`guild-banner-container ${className}`.trim()}
      data-testid="guild-leaderboard-banner"
    >
      <div className="guild-banner-header">
        <div className="guild-banner-title-group">
          <span className="guild-banner-icon" role="img" aria-label="trophy">
            🛡️
          </span>
          <h2 className="guild-banner-title">Clan Guild Leaderboard</h2>
        </div>
        <span className="guild-banner-season" data-testid="season-label">
          {seasonLabel}
        </span>
      </div>

      {!hasGuilds ? (
        <div className="guild-empty-state" data-testid="guild-empty-state">
          <div className="guild-empty-icon">⚔️</div>
          <div className="guild-empty-title">Season Leaderboard Pending</div>
          <div className="guild-empty-desc">
            The {seasonLabel} clan leaderboard has not yet launched. Clans will appear here
            once the tournament matches begin.
          </div>
        </div>
      ) : (
        <div className="guild-podium-grid" data-testid="guild-podium">
          {topGuilds.map((guild) => {
            const rank = guild.rank || 1;
            const rankClass = `rank-${rank}`;
            const badgeLabel = getRankBadgeLabel(rank);

            return (
              <div
                key={guild.id}
                className={`guild-card ${rankClass}`}
                data-testid={`guild-card-${guild.id}`}
              >
                <div className="guild-rank-badge">{badgeLabel}</div>

                <div className="guild-crest-wrapper">
                  {guild.crestUrl ? (
                    <img
                      src={guild.crestUrl}
                      alt={`${guild.name} crest`}
                      className="guild-crest-img"
                    />
                  ) : (
                    <div
                      className="guild-crest-fallback"
                      data-testid={`guild-crest-fallback-${guild.id}`}
                    >
                      {getInitials(guild.name)}
                    </div>
                  )}
                </div>

                <div className="guild-name-group">
                  <div className="guild-name">
                    {guild.name}
                    {guild.tag && <span className="guild-tag">{guild.tag}</span>}
                  </div>
                </div>

                <div className="guild-stats-container">
                  <div className="guild-stat-row">
                    <span className="guild-stat-label">Members</span>
                    <span className="guild-stat-value">{guild.memberCount.toLocaleString()}</span>
                  </div>
                  <div className="guild-stat-row">
                    <span className="guild-stat-label">Win Rate</span>
                    <span className="guild-stat-value">{guild.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="guild-stat-row">
                    <span className="guild-stat-label">Season Volume</span>
                    <span className="guild-stat-value volume">
                      {guild.seasonalVolumeXlm.toLocaleString()} XLM
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="guild-join-btn"
                  onClick={() => onJoinGuild?.(guild.id)}
                  aria-label={`Join Clan ${guild.name}`}
                >
                  Join Clan
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
