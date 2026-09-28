import React, { useState } from 'react';
import { JackpotMilestoneProgressProps, MilestoneNotch } from './types';
import './JackpotMilestoneProgress.css';

/**
 * Clamps pool progress percentage between 0 and 100.
 * Handles edge cases like 0 or negative targets cleanly.
 */
export function clampProgress(current: number, target: number): number {
  if (!target || target <= 0 || Number.isNaN(target)) return 0;
  if (!current || current <= 0 || Number.isNaN(current)) return 0;
  const ratio = (current / target) * 100;
  return Math.min(100, Math.max(0, ratio));
}

const DEFAULT_NOTCHES: { percentage: number; label: string }[] = [
  { percentage: 50, label: '50%' },
  { percentage: 75, label: '75%' },
  { percentage: 100, label: '100% Trigger' },
];

export const JackpotMilestoneProgress: React.FC<JackpotMilestoneProgressProps> = ({
  currentPoolXlm = 0,
  targetThresholdXlm,
  estimatedTimeToDrop,
  houseSeedXlm,
  playerFeesXlm,
  bonusMultiplier,
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const safeCurrent = Math.max(0, currentPoolXlm || 0);
  const safeTarget = Math.max(0, targetThresholdXlm || 0);
  const progressPercent = clampProgress(safeCurrent, safeTarget);
  const roundedPercent = Math.round(progressPercent);
  const isUrgent = progressPercent >= 90;

  // SVG Radial dimensions
  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const effectiveHouseSeed =
    houseSeedXlm !== undefined ? houseSeedXlm : Math.round(safeCurrent * 0.4);
  const effectivePlayerFees =
    playerFeesXlm !== undefined ? playerFeesXlm : safeCurrent - effectiveHouseSeed;

  return (
    <div
      className={`jackpot-milestone-card ${isUrgent ? 'jackpot-gauge-urgent-pulse' : ''} ${className}`.trim()}
      data-testid="jackpot-milestone-card"
    >
      <div className="jackpot-gauge-header">
        <h3 className="jackpot-gauge-title">
          <span>🏆 Jackpot Pool</span>
        </h3>
        {bonusMultiplier && bonusMultiplier > 1 && (
          <span className="jackpot-multiplier-badge" data-testid="bonus-multiplier">
            {bonusMultiplier}x Bonus
          </span>
        )}
      </div>

      {estimatedTimeToDrop && (
        <div className="jackpot-countdown-banner" data-testid="drop-countdown">
          ⏳ Est. Drop: {estimatedTimeToDrop}
        </div>
      )}

      <div className="jackpot-gauge-wrapper">
        <svg
          className="jackpot-radial-svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="progressbar"
          aria-valuenow={roundedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Jackpot milestone progress"
        >
          <defs>
            <linearGradient id="jackpotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="60%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          {/* Background circle track */}
          <circle
            className="jackpot-track-bg"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Progress circle */}
          <circle
            className="jackpot-progress-bar"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#jackpotGradient)"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        <div className="jackpot-center-content">
          <span className="jackpot-percentage-text" data-testid="progress-percentage">
            {roundedPercent}%
          </span>
          <span className="jackpot-balance-label">Current Balance</span>
          <span className="jackpot-balance-value" data-testid="current-balance">
            {safeCurrent.toLocaleString()} XLM
          </span>
          <span className="jackpot-target-caption">
            Target: {safeTarget.toLocaleString()} XLM
          </span>
        </div>
      </div>

      {/* Milestone Notches */}
      <div className="jackpot-notches-container" data-testid="milestone-notches">
        {DEFAULT_NOTCHES.map((notch) => {
          const isPassed = progressPercent >= notch.percentage;
          return (
            <div
              key={notch.percentage}
              className={`jackpot-notch ${isPassed ? 'passed' : ''}`}
              data-testid={`notch-${notch.percentage}`}
            >
              <div className="jackpot-notch-pip" />
              <span>{notch.label}</span>
            </div>
          );
        })}
      </div>

      {/* Contribution breakdown trigger & tooltip */}
      <div
        className="jackpot-details-trigger"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        tabIndex={0}
        aria-label="View contribution breakdown"
      >
        <div className="jackpot-contribution-summary">
          <span>Pool Composition</span>
          <span>ℹ️ Hover for details</span>
        </div>

        {showTooltip && (
          <div className="jackpot-tooltip" role="tooltip" data-testid="contribution-tooltip">
            <div className="jackpot-tooltip-row">
              <span>House Seeding:</span>
              <strong>{effectiveHouseSeed.toLocaleString()} XLM</strong>
            </div>
            <div className="jackpot-tooltip-row">
              <span>Player Fees:</span>
              <strong>{effectivePlayerFees.toLocaleString()} XLM</strong>
            </div>
            <div className="jackpot-tooltip-row">
              <span>Total Escrow:</span>
              <strong>{safeCurrent.toLocaleString()} XLM</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
