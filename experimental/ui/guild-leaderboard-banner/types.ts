export interface GuildLeaderboardEntry {
  id: string;
  name: string;
  tag?: string; // e.g. "[STELL]"
  crestUrl?: string;
  memberCount: number;
  winRate: number; // e.g. 74.5
  seasonalVolumeXlm: number;
  rank?: number; // 1, 2, 3
  tournamentPoints?: number;
}

export interface GuildLeaderboardBannerProps {
  guilds: GuildLeaderboardEntry[];
  seasonLabel?: string;
  onJoinGuild?: (guildId: string) => void;
  className?: string;
}
