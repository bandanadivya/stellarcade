import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});
import {
  JackpotMilestoneProgress,
  clampProgress,
} from './JackpotMilestoneProgress';

describe('JackpotMilestoneProgress', () => {
  it('calculates and displays percentage matching current vs target ratio', () => {
    render(<JackpotMilestoneProgress currentPoolXlm={5000} targetThresholdXlm={10000} />);

    expect(screen.getByTestId('progress-percentage')).toHaveTextContent('50%');
    expect(screen.getByTestId('current-balance')).toHaveTextContent('5,000 XLM');

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('applies urgency pulse class when pool is at or above 90% threshold', () => {
    const { rerender } = render(
      <JackpotMilestoneProgress currentPoolXlm={8500} targetThresholdXlm={10000} />
    );

    const card = screen.getByTestId('jackpot-milestone-card');
    expect(card).not.toHaveClass('jackpot-gauge-urgent-pulse');

    rerender(<JackpotMilestoneProgress currentPoolXlm={9200} targetThresholdXlm={10000} />);
    expect(card).toHaveClass('jackpot-gauge-urgent-pulse');
  });

  it('displays zero balance as a valid starting state without NaN', () => {
    render(<JackpotMilestoneProgress currentPoolXlm={0} targetThresholdXlm={10000} />);

    expect(screen.getByTestId('progress-percentage')).toHaveTextContent('0%');
    expect(screen.getByTestId('current-balance')).toHaveTextContent('0 XLM');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders milestone notches and marks reached milestones as passed', () => {
    render(<JackpotMilestoneProgress currentPoolXlm={7800} targetThresholdXlm={10000} />);

    const notch50 = screen.getByTestId('notch-50');
    const notch75 = screen.getByTestId('notch-75');
    const notch100 = screen.getByTestId('notch-100');

    expect(notch50).toHaveClass('passed');
    expect(notch75).toHaveClass('passed');
    expect(notch100).not.toHaveClass('passed');
  });

  it('shows tooltip detailing house seeding vs player fee contributions on hover', () => {
    render(
      <JackpotMilestoneProgress
        currentPoolXlm={10000}
        targetThresholdXlm={10000}
        houseSeedXlm={4000}
        playerFeesXlm={6000}
      />
    );

    expect(screen.queryByTestId('contribution-tooltip')).not.toBeInTheDocument();

    const trigger = screen.getByLabelText(/View contribution breakdown/i);
    fireEvent.mouseEnter(trigger);

    expect(screen.getByTestId('contribution-tooltip')).toBeInTheDocument();
    expect(screen.getByText('4,000 XLM')).toBeInTheDocument();
    expect(screen.getByText('6,000 XLM')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByTestId('contribution-tooltip')).not.toBeInTheDocument();
  });

  it('renders estimated drop countdown and bonus multiplier when provided', () => {
    render(
      <JackpotMilestoneProgress
        currentPoolXlm={9500}
        targetThresholdXlm={10000}
        estimatedTimeToDrop="~45 mins"
        bonusMultiplier={2.5}
      />
    );

    expect(screen.getByTestId('drop-countdown')).toHaveTextContent('~45 mins');
    expect(screen.getByTestId('bonus-multiplier')).toHaveTextContent('2.5x Bonus');
  });

  describe('clampProgress utility', () => {
    it('clamps cleanly between 0% and 100%', () => {
      expect(clampProgress(50, 100)).toBe(50);
      expect(clampProgress(-10, 100)).toBe(0);
      expect(clampProgress(150, 100)).toBe(100);
      expect(clampProgress(0, 100)).toBe(0);
    });

    it('handles zero or invalid target gracefully', () => {
      expect(clampProgress(50, 0)).toBe(0);
      expect(clampProgress(50, -50)).toBe(0);
      expect(clampProgress(NaN, 100)).toBe(0);
      expect(clampProgress(50, NaN)).toBe(0);
    });
  });
});
