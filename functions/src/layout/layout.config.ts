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
  nodeWidth: 320,
  nodeHeight: 150,
  horizontalSpacing: 70,
  spouseSpacing: 40,
  laneHeight: 260,
  laneGap: 0, // Zero gap between horizontal generation strips
  laneMarginX: 80,
  laneMarginY: 0, // Seamless continuous canvas
  compactLanes: false,
  unknownLanePlacement: 'bottom',
  minCanvasWidth: 1600,
  minCanvasHeight: 1200,
};

export function mergeLayoutConfig(custom?: Partial<LayoutConfig>): LayoutConfig {
  if (!custom) return { ...DEFAULT_LAYOUT_CONFIG };
  return {
    ...DEFAULT_LAYOUT_CONFIG,
    ...custom,
  };
}
