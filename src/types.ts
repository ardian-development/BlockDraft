export interface BlockPlacement {
  x: number;
  y: number;
  z: number;
  /** Stable palette group used by the renderer and exporter. */
  material: string;
  blockId: string;
  sourceOperationId: string;
}

export interface CompiledStructure {
  blocks: BlockPlacement[];
  dimensions: { x: number; y: number; z: number };
  histogram: Record<string, number>;
  warnings: string[];
}
