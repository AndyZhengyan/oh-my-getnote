// web/components/graph/useGraphData.ts
import { useMemo } from 'react';
import type { GraphIndex } from '@/stores/graphStore';
import type { NodeLevel, GraphNode, LinkData, GraphData, NodeVisual } from './types';

export function buildLevelMap(
  selectedNodeId: string | null,
  focusedNodeId: string | null,
  focusedNeighborIds: string[] | Set<string>,
  browsePath: string[],
  graphIndex: GraphIndex | null,
): ReadonlyMap<string, NodeLevel> {
  if (!graphIndex) return new Map();

  const result = new Map<string, NodeLevel>();

  // 1. Mark trajectory nodes
  for (const id of browsePath) result.set(id, 'trajectory');

  const seedId = selectedNodeId ?? focusedNodeId;
  if (!seedId) {
    for (const id of Object.keys(graphIndex.index)) {
      if (!result.has(id)) result.set(id, 'peripheral');
    }
    return result;
  }

  // BFS up to depth 2
  const visited = new Set<string>();
  const queue: [id: string, depth: number][] = [[seedId, 0]];
  visited.add(seedId);

  while (queue.length > 0) {
    const [id, depth] = queue.shift()!;
    const level = depth === 0
      ? 'focused'
      : depth === 1
        ? 'level1'
        : depth === 2
          ? 'level2'
          : undefined;
    if (level !== undefined) result.set(id, level);
    else continue;

    if (depth >= 2) continue;
    const conns = graphIndex.index[id]?.connections ?? [];
    for (const conn of conns) {
      if (!visited.has(conn.noteId)) {
        visited.add(conn.noteId);
        queue.push([conn.noteId, depth + 1]);
      }
    }
  }

  for (const id of Object.keys(graphIndex.index)) {
    if (!result.has(id)) result.set(id, 'ghost');
  }

  for (const id of browsePath) result.set(id, 'trajectory');

  return result;
}

export function getNodeVisual(level: NodeLevel): NodeVisual {
  switch (level) {
    case 'focused':    return { alpha: 1.0, rBase: 8, rScale: 1.1, ghost: false };
    case 'trajectory': return { alpha: 1.0, rBase: 7, rScale: 1.0, ghost: false };
    case 'level1':     return { alpha: 0.8, rBase: 5, rScale: 1.0, ghost: false };
    case 'level2':     return { alpha: 0.2, rBase: 4, rScale: 0.8, ghost: false };
    case 'ghost':      return { alpha: 0.04, rBase: 2, rScale: 0.5, ghost: true };
    default:           return { alpha: 0.5, rBase: 3, rScale: 1.0, ghost: false };
  }
}

export function useGraphData(
  graphIndex: GraphIndex | null,
  typeFilter: string,
  tagTreeFilter: string,
  searchQuery: string,
  levelMap: ReadonlyMap<string, NodeLevel>,
  selectedNodeId: string | null,
  focusedNodeId: string | null,
  browsePath: string[],
): GraphData {
  return useMemo(() => {
    return buildGraphData(
      graphIndex,
      typeFilter,
      tagTreeFilter,
      searchQuery,
      levelMap,
      selectedNodeId,
      focusedNodeId,
      browsePath,
    );
  }, [graphIndex, typeFilter, tagTreeFilter, searchQuery, levelMap, selectedNodeId, focusedNodeId, browsePath]);
}

function buildGraphData(
  index: GraphIndex | null,
  typeFilter: string,
  tagTreeFilter: string,
  searchQuery: string,
  levelMap: ReadonlyMap<string, NodeLevel>,
  selectedNodeId: string | null,
  focusedNodeId: string | null,
  browsePath: string[],
): GraphData {
  if (!index) return { nodes: [], links: [] };

  const q = searchQuery.toLowerCase();
  const nodes: GraphNode[] = [];
  const links: LinkData[] = [];
  const seenNodes = new Set<string>();

  const activeIds = new Set<string>();
  for (const [id, entry] of Object.entries(index.index)) {
    if (typeFilter && entry.type !== typeFilter) continue;
    if (tagTreeFilter && !entry.tagTree.some(p => p.startsWith(tagTreeFilter))) continue;
    if (q && !entry.title.toLowerCase().includes(q) && !entry.bodyPreview?.toLowerCase().includes(q)) continue;
    activeIds.add(id);
  }

  for (const id of browsePath) {
    if (index.index[id]) activeIds.add(id);
  }

  const showAllConnections = selectedNodeId !== null || focusedNodeId !== null;
  const MAX_CONNS_PER_NODE = showAllConnections ? Infinity : 3;

  const isFewNodes = activeIds.size <= 4;

  for (const id of activeIds) {
    const entry = index.index[id]!;
    if (!seenNodes.has(id)) {
      seenNodes.add(id);
      const cached = (globalThis as unknown as { _nodePosCache?: Map<string, { x: number; y: number }> })._nodePosCache?.get(id);

      const node: GraphNode = {
        id,
        title: entry.title,
        type: entry.type,
        connections: entry.connections.length,
        snippet: entry.bodyPreview ?? '',
        ...cached,
      };

      if (isFewNodes) {
        node.fx = 0;
        node.fy = 0;
        if (activeIds.size > 1) {
          const idx = nodes.length;
          const angle = (idx / activeIds.size) * Math.PI * 2;
          node.fx = Math.cos(angle) * 20;
          node.fy = Math.sin(angle) * 20;
        }
      }

      nodes.push(node);
    }

    const conns = showAllConnections
      ? entry.connections
      : [...entry.connections].sort((a, b) => b.score - a.score).slice(0, MAX_CONNS_PER_NODE);

    for (const conn of conns) {
      if (activeIds.has(conn.noteId)) {
        links.push({ source: id, target: conn.noteId, score: conn.score });
      }
    }
  }

  const seenTrailLinks = new Set<string>();
  for (let i = 0; i < browsePath.length - 1; i++) {
    const a = browsePath[i];
    const b = browsePath[i + 1];
    if (!activeIds.has(a) || !activeIds.has(b)) continue;
    const key = [a, b].sort().join('→');
    if (!seenTrailLinks.has(key)) {
      seenTrailLinks.add(key);
      links.push({ source: a, target: b });
    }
  }

  return { nodes, links };
}
