// web/components/graph/types.ts
import type { GraphIndex } from '@/stores/graphStore';

export type NodeLevel = 'focused' | 'level1' | 'level2' | 'peripheral' | 'ghost' | 'trajectory';

export interface GraphNode {
  id: string;
  title: string;
  type: string;
  connections: number;
  snippet?: string;
  x?: number;
  y?: number;
  fx?: number | undefined;
  fy?: number | undefined;
}

export interface TooltipState {
  nodeId: string;
  x: number;
  y: number;
  title: string;
  type: string;
  createdAt: string;
  snippet: string;
}

export interface LinkData {
  source: string;
  target: string;
  score?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: LinkData[];
}

export interface NodeVisual {
  alpha: number;
  rBase: number;
  rScale: number;
  ghost: boolean;
}
