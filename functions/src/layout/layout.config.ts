export interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  horizontalSpacing: number;
  spouseSpacing: number;
  laneHeight: number;
  laneGap: number;
  laneMarginX: number;
  laneMarginY: number;
  compactLanes: boolean;
  unknownLanePlacement: 'top' | 'bottom';
  minCanvasWidth: number;
  minCanvasHeight: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  nodeWidth: 220,
  nodeHeight: 100,
  horizontalSpacing: 50,
  spouseSpacing: 30,
  laneHeight: 180,
  laneGap: 60,
  laneMarginX: 80,
  laneMarginY: 80,
  compactLanes: false,
  unknownLanePlacement: 'bottom',
  minCanvasWidth: 1200,
  minCanvasHeight: 800,
};

export function mergeLayoutConfig(custom?: Partial<LayoutConfig>): LayoutConfig {
  if (!custom) return { ...DEFAULT_LAYOUT_CONFIG };
  return {
    ...DEFAULT_LAYOUT_CONFIG,
    ...custom,
  };
}

