export interface ActivityPing {
  id: string;
  x: number; // 0-100, normalized coordinate on radar
  y: number; // 0-100, normalized coordinate on radar
  gameName: string;
  wagerSize: number;
  timestamp: number; // milliseconds since creation
}

export interface ActivityRadarProps {
  pings: ActivityPing[];
  scanSpeedMs?: number;
  onSelectPing?: (ping: ActivityPing) => void;
  className?: string;
  testId?: string;
}
