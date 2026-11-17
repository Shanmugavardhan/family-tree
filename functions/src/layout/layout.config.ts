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
  inferGenerations?: boolean;
  unknownLanePlacement: 'top' | 'bottom';
  minCanvasWidth: number;
  minCanvasHeight: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  nodeWidth: 380,
  nodeHeight: 180,
  horizontalSpacing: 80,
  spouseSpacing: 50,
  laneHeight: 420, // Vertically wider strips as requested
  laneGap: 0, // Zero gap between horizontal generation strips
  laneMarginX: 80,
  laneMarginY: 0, // Seamless continuous canvas
  compactLanes: false,
  inferGenerations: false,
  unknownLanePlacement: 'bottom',
  minCanvasWidth: 1800,
  minCanvasHeight: 1400,
};

export function mergeLayoutConfig(custom?: Partial<LayoutConfig>): LayoutConfig {
  if (!custom) return { ...DEFAULT_LAYOUT_CONFIG };
  return {
    ...DEFAULT_LAYOUT_CONFIG,
    ...custom,
  };
}
