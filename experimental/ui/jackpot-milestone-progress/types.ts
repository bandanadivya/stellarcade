export interface MilestoneNotch {
  percentage: number;
  label: string;
  isPassed: boolean;
}

export interface JackpotMilestoneProgressProps {
  currentPoolXlm: number;
  targetThresholdXlm: number;
  estimatedTimeToDrop?: string;
  houseSeedXlm?: number;
  playerFeesXlm?: number;
  bonusMultiplier?: number;
  className?: string;
}
