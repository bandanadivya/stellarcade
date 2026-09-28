'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityPing, ActivityRadarProps } from './types';
import './ActivityRadar.css';

// Configuration constants
const CANVAS_SIZE = 400;
const CENTER_X = CANVAS_SIZE / 2;
const CENTER_Y = CANVAS_SIZE / 2;
const MAX_RADIUS = CENTER_X - 20;
const GRID_RADIUS = MAX_RADIUS / 3;
const GRID_LINES = 3;

// Blip fade duration in milliseconds
const BLIP_FADE_DURATION = 3000;

// Ping click detection radius in pixels
const PING_CLICK_RADIUS = 12;

interface CanvasBlip {
  ping: ActivityPing;
  createdAt: number;
}

export const ActivityRadar: React.FC<ActivityRadarProps> = ({
  pings,
  scanSpeedMs = 4000,
  onSelectPing,
  className = '',
  testId = 'activity-radar',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const blipsRef = useRef<CanvasBlip[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const isVisibleRef = useRef<boolean>(true);
  const [activeMatchCount, setActiveMatchCount] = useState(0);
  const [matchesPerMinute, setMatchesPerMinute] = useState(0);
  const lastCountRef = useRef<number>(0);
  const pingsPerMinuteRef = useRef<number[]>([]);

  // Update canvas blips when pings change
  useEffect(() => {
    const now = Date.now();
    const existingIds = new Set(blipsRef.current.map((b) => b.ping.id));

    // Add new pings
    pings.forEach((ping) => {
      if (!existingIds.has(ping.id)) {
        blipsRef.current.push({
          ping,
          createdAt: now,
        });
      }
    });

    // Remove pings that no longer exist or have faded
    blipsRef.current = blipsRef.current.filter((blip) => {
      const age = now - blip.createdAt;
      return age < BLIP_FADE_DURATION && pings.some((p) => p.id === blip.ping.id);
    });

    // Update match count
    setActiveMatchCount(blipsRef.current.length);

    // Track pings per minute
    pingsPerMinuteRef.current.push(now);
    pingsPerMinuteRef.current = pingsPerMinuteRef.current.filter(
      (timestamp) => now - timestamp < 60000,
    );
    setMatchesPerMinute(pingsPerMinuteRef.current.length);
  }, [pings]);

  // Visibility tracking for battery/CPU conservation
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Draw grid and radar elements
  const drawRadarGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
    ctx.lineWidth = 1;

    // Concentric circles (grid rings)
    for (let i = 1; i <= GRID_LINES; i++) {
      const radius = (MAX_RADIUS / GRID_LINES) * i;
      ctx.beginPath();
      ctx.arc(CENTER_X, CENTER_Y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshair lines
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CENTER_X - MAX_RADIUS - 10, CENTER_Y);
    ctx.lineTo(CENTER_X + MAX_RADIUS + 10, CENTER_Y);
    ctx.moveTo(CENTER_X, CENTER_Y - MAX_RADIUS - 10);
    ctx.lineTo(CENTER_X, CENTER_Y + MAX_RADIUS + 10);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  // Draw rotating sweep line
  const drawSweepLine = (ctx: CanvasRenderingContext2D, rotation: number) => {
    ctx.save();
    ctx.translate(CENTER_X, CENTER_Y);
    ctx.rotate(rotation);

    const gradient = ctx.createLinearGradient(0, 0, MAX_RADIUS, 0);
    gradient.addColorStop(0, 'rgba(0, 255, 150, 0.8)');
    gradient.addColorStop(0.5, 'rgba(0, 255, 150, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 255, 150, 0)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(MAX_RADIUS, 0);
    ctx.stroke();

    ctx.restore();
  };

  // Convert normalized coordinates (0-100) to canvas pixels
  const normalizedToCanvas = (x: number, y: number): [number, number] => {
    const angle = (x / 100) * Math.PI * 2;
    const distance = (y / 100) * MAX_RADIUS;
    return [
      CENTER_X + distance * Math.cos(angle),
      CENTER_Y + distance * Math.sin(angle),
    ];
  };

  // Draw blips (pings)
  const drawBlips = (ctx: CanvasRenderingContext2D, now: number) => {
    blipsRef.current.forEach((blip) => {
      const age = now - blip.createdAt;
      const progress = age / BLIP_FADE_DURATION;
      const opacity = Math.max(0, 1 - progress);

      const [canvasX, canvasY] = normalizedToCanvas(blip.ping.x, blip.ping.y);

      // Outer glow
      ctx.fillStyle = `rgba(255, 100, 200, ${opacity * 0.4})`;
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 12, 0, Math.PI * 2);
      ctx.fill();

      // Middle ring
      ctx.fillStyle = `rgba(255, 50, 150, ${opacity * 0.6})`;
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Core blip
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  // Handle canvas clicks for blip selection
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !onSelectPing) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    blipsRef.current.forEach((blip) => {
      const [canvasX, canvasY] = normalizedToCanvas(blip.ping.x, blip.ping.y);
      const distance = Math.sqrt(Math.pow(clickX - canvasX, 2) + Math.pow(clickY - canvasY, 2));

      if (distance <= PING_CLICK_RADIUS) {
        onSelectPing(blip.ping);
      }
    });
  };

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (!isVisibleRef.current) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      const rotation = (elapsed % scanSpeedMs) / scanSpeedMs * Math.PI * 2;

      // Clear canvas
      ctx.fillStyle = 'rgba(10, 25, 45, 1)';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Draw components
      drawRadarGrid(ctx);
      drawSweepLine(ctx, rotation);
      drawBlips(ctx, now);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [scanSpeedMs]);

  return (
    <div
      className={`activity-radar ${className}`}
      data-testid={testId}
      data-match-count={activeMatchCount}
    >
      <div className="activity-radar__container">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="activity-radar__canvas"
          data-testid={`${testId}-canvas`}
          onClick={handleCanvasClick}
          role="img"
          aria-label={`Activity radar showing ${activeMatchCount} active matches`}
        />
      </div>

      <div className="activity-radar__stats">
        <div className="activity-radar__stat-item">
          <span className="activity-radar__stat-label">Active Matches</span>
          <span
            className="activity-radar__stat-value"
            data-testid={`${testId}-match-count`}
          >
            {activeMatchCount}
          </span>
        </div>

        <div className="activity-radar__stat-item">
          <span className="activity-radar__stat-label">Matches/Min</span>
          <span
            className="activity-radar__stat-value"
            data-testid={`${testId}-matches-per-minute`}
          >
            {matchesPerMinute}
          </span>
        </div>
      </div>

      <div className="activity-radar__tooltip" data-testid={`${testId}-tooltip`} />
    </div>
  );
};

ActivityRadar.displayName = 'ActivityRadar';
export default ActivityRadar;
