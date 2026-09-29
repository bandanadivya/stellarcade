'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AudioSpectrumVisualizerProps } from './types';
import './AudioSpectrumVisualizer.css';

const ALLOWED_BAR_COUNTS = [8, 16, 32];
const DEFAULT_BAR_COUNT = 16;
const FALLOFF = 0.72;
const PEAK_DECAY = 0.02;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const ensureLength = (values: number[], length: number): number[] => {
  const next = new Array<number>(length);
  for (let i = 0; i < length; i++) {
    next[i] = values[i] ?? 0;
  }
  return next;
};

export const AudioSpectrumVisualizer: React.FC<AudioSpectrumVisualizerProps> = ({
  isPlaying,
  isMuted = false,
  theme = 'neon',
  barCount = DEFAULT_BAR_COUNT,
  sensitivity = 1,
  className = '',
  testId = 'audio-spectrum-visualizer',
}) => {
  const safeBarCount = ALLOWED_BAR_COUNTS.includes(barCount)
    ? barCount
    : DEFAULT_BAR_COUNT;
  const safeSensitivity = clamp(sensitivity, 0.1, 1);

  const levelsRef = useRef<number[]>(new Array(safeBarCount).fill(0));
  const peaksRef = useRef<number[]>(new Array(safeBarCount).fill(0));
  const [, setFrame] = useState(0);

  useEffect(() => {
    levelsRef.current = ensureLength(levelsRef.current, safeBarCount);
    peaksRef.current = ensureLength(peaksRef.current, safeBarCount);

    if (!isPlaying) {
      levelsRef.current = new Array(safeBarCount).fill(0);
      peaksRef.current = new Array(safeBarCount).fill(0);
      setFrame((frame) => frame + 1);
      return;
    }

    let cancelled = false;
    let rafId: number | undefined;

    const supportsRaf =
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function';

    const raf = supportsRaf
      ? (window.requestAnimationFrame as typeof window.requestAnimationFrame).bind(
          window,
        )
      : (cb: FrameRequestCallback) =>
          window.setTimeout(
            () => cb(performance.now()),
            16,
          ) as unknown as number;

    const caf = supportsRaf
      ? (window.cancelAnimationFrame as typeof window.cancelAnimationFrame).bind(
          window,
        )
      : (id: number) => window.clearTimeout(id);

    const tick = () => {
      if (cancelled) {
        return;
      }

      for (let i = 0; i < safeBarCount; i++) {
        let level: number;
        let peak: number;
        if (isMuted) {
          level = 0;
          peak = 0;
        } else {
          const decayed = levelsRef.current[i] * FALLOFF;
          const impulse = Math.random() * safeSensitivity * 0.8;
          level = clamp(decayed + impulse, 0, 1);
          peak = Math.max(level, peaksRef.current[i] - PEAK_DECAY);
        }
        levelsRef.current[i] = level;
        peaksRef.current[i] = peak;
      }

      setFrame((frame) => frame + 1);
      rafId = raf(tick);
    };

    rafId = raf(tick);

    return () => {
      cancelled = true;
      if (rafId !== undefined) {
        caf(rafId);
      }
    };
  }, [isPlaying, isMuted, safeBarCount, safeSensitivity]);

  const statusText = isMuted
    ? 'Sound visualizer muted — frequency bars flatlined.'
    : isPlaying
      ? 'Sound visualizer active — spectrum animating.'
      : 'Sound visualizer paused.';

  const barHeights = Array.from(
    { length: safeBarCount },
    (_, index) => levelsRef.current[index] ?? 0,
  );
  const peakHeights = Array.from(
    { length: safeBarCount },
    (_, index) => peaksRef.current[index] ?? 0,
  );

  return (
    <div className={`audio-spectrum-visualizer ${className}`} data-testid={testId}>
      <div
        className={`audio-spectrum-visualizer__bars audio-spectrum-visualizer__bars--theme-${theme} ${
          isPlaying ? 'audio-spectrum-visualizer__bars--playing' : ''
        } ${isMuted ? 'audio-spectrum-visualizer__bars--muted' : ''}`}
        data-testid={`${testId}-bars`}
        data-animating={isPlaying}
        data-muted={isMuted}
        aria-hidden="true"
      >
        {barHeights.map((level, index) => (
          <div
            key={index}
            className={`audio-spectrum-visualizer__bar ${
              isMuted ? 'audio-spectrum-visualizer__bar--flat' : ''
            }`}
            data-testid={`${testId}-bar-${index}`}
            data-height={Math.round(level * 100)}
            style={{ height: `${Math.round(level * 100)}%` }}
          >
            <span
              className="audio-spectrum-visualizer__peak"
              style={{ height: `${Math.round(peakHeights[index] * 100)}%` }}
              data-testid={`${testId}-peak-${index}`}
            />
          </div>
        ))}
      </div>

      {/*   <span
        className="audio-spectrum-visualizer__sr-text"
        role="status"
        aria-live="polite"
      >
        {statusText}
      </span> */}

      <span
        className="audio-spectrum-visualizer__sr-text"
        role="status"
        aria-live="polite"
      >
        {statusText}
      </span>
    </div>
  );
};

AudioSpectrumVisualizer.displayName = 'AudioSpectrumVisualizer';
export default AudioSpectrumVisualizer;