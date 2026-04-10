// web/lib/recommend.ts
// Frontend-only synthesis of recommended paths from vector search results.
// No AI API calls — pure heuristic scoring + explanation generation.

import type { RecommendedPath } from '@/stores/graphStore';

// Re-export so consumers can import the type from a single place
export type { RecommendedPath };

export interface VectorResult {
  id: string;
  title: string;
  type: string;
  text: string;
  score: number;
}

interface GraphIndexEntry {
  path: string;
  domain: string;
  type: string;
  title: string;
  bodyPreview?: string;
  connections: Array<{ noteId: string; score: number; type: string }>;
}

/**
 * Synthesize top-3 recommended paths from vector search results + graph context.
 *
 * Scoring: 55% vector similarity + 25% domain alignment (recency-weighted) + 20% direct connection bonus.
 * Returns paths WITHOUT domainColor — LeftNav applies DOMAIN_COLORS after calling this.
 */
export function synthesizeRecommendedPaths(
  rawResults: VectorResult[],
  browsePath: string[],
  graphIndex: Record<string, GraphIndexEntry> | null,
): RecommendedPath[] {
  if (!rawResults.length || !graphIndex) return [];

  const scored = rawResults.map(result => {
    const entry = graphIndex[result.id];
    const composite = computeCompositeScore(result, browsePath, graphIndex);

    return {
      noteId: result.id,
      title: result.title,
      domain: entry?.domain ?? '',
      domainColor: '', // resolved by caller via DOMAIN_COLORS
      type: result.type,
      score: result.score,
      compositeScore: composite.total,
      text: result.text ?? '',
      explanation: generateExplanation(result, browsePath, graphIndex),
      whyFrom: composite.contributingNodes,
      isSaved: false,
      bodyPreview: entry?.bodyPreview,
      connections: entry?.connections ?? [],
    };
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);
  return scored.slice(0, 3);
}

// ─── Scoring helpers ─────────────────────────────────────────────────────────

interface CompositeScore {
  total: number;
  contributingNodes: string[];
}

/** Composite score = 55% vector similarity + 25% domain alignment + 20% connection bonus */
function computeCompositeScore(
  result: VectorResult,
  browsePath: string[],
  graphIndex: Record<string, GraphIndexEntry>,
): CompositeScore {
  const VECTOR_WEIGHT = 0.55;
  const DOMAIN_WEIGHT = 0.25;
  const CONN_WEIGHT = 0.20;

  const vectorScore = result.score;
  const domainScore = computeDomainAlignment(result, browsePath, graphIndex);
  const { score: connScore, nodes: contributingNodes } = computeConnectionBonus(
    result.id,
    browsePath,
    graphIndex,
  );

  return {
    total: vectorScore * VECTOR_WEIGHT + domainScore * DOMAIN_WEIGHT + connScore * CONN_WEIGHT,
    contributingNodes,
  };
}

/**
 * Domain alignment score: fraction of browsePath nodes (weighted by recency)
 * that share the candidate's domain.
 * Most-recent node gets weight 1.0; earlier nodes decay by 0.6^(distance).
 */
function computeDomainAlignment(
  result: VectorResult,
  browsePath: string[],
  graphIndex: Record<string, GraphIndexEntry>,
): number {
  if (!browsePath.length) return 0;
  const resultDomain = graphIndex[result.id]?.domain ?? '';
  if (!resultDomain) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  browsePath.forEach((nodeId, i) => {
    const weight = Math.pow(0.6, browsePath.length - 1 - i);
    totalWeight += weight;
    if (graphIndex[nodeId]?.domain === resultDomain) {
      weightedSum += weight;
    }
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Direct connection bonus: if any browsePath node connects directly to
 * the candidate, award bonus proportional to recency (decay 0.7).
 */
function computeConnectionBonus(
  candidateId: string,
  browsePath: string[],
  graphIndex: Record<string, GraphIndexEntry>,
): { score: number; nodes: string[] } {
  const DECAY = 0.7;
  let score = 0;
  const nodes: string[] = [];

  browsePath.forEach((nodeId, i) => {
    const conns = graphIndex[nodeId]?.connections ?? [];
    if (conns.some(c => c.noteId === candidateId)) {
      const weight = Math.pow(DECAY, browsePath.length - 1 - i);
      score += weight;
      nodes.push(nodeId);
    }
  });

  return { score: Math.min(score, 1), nodes };
}

// ─── Explanation generation ──────────────────────────────────────────────────

/**
 * Generate a Chinese human-readable explanation for why this result is recommended,
 * using only frontend-only heuristics.
 */
function generateExplanation(
  result: VectorResult,
  browsePath: string[],
  graphIndex: Record<string, GraphIndexEntry>,
): string {
  const parts: string[] = [];
  const entry = graphIndex[result.id];

  // 1. Domain alignment explanation
  if (browsePath.length > 0 && entry?.domain) {
    const alignedNodes = browsePath.filter(
      id => graphIndex[id]?.domain === entry.domain,
    );
    if (alignedNodes.length > 0) {
      const recentAligned = alignedNodes.slice(-2);
      const titles = recentAligned
        .map(id => graphIndex[id]?.title ?? '')
        .filter(Boolean);

      if (titles.length === 1) {
        parts.push(`与「${titles[0]}」同属 ${entry.domain}`);
      } else {
        parts.push(`与知识链中最近的同类节点「${titles[titles.length - 1]}」同属 ${entry.domain}`);
      }
    }
  }

  // 2. Direct connection explanation — mention most recent connected node
  let lastConnectedTitle: string | undefined;
  for (let i = browsePath.length - 1; i >= 0; i--) {
    const nodeId = browsePath[i];
    const conns = graphIndex[nodeId]?.connections ?? [];
    const found = conns.find(c => c.noteId === result.id);
    if (found) {
      lastConnectedTitle = graphIndex[nodeId]?.title ?? nodeId;
      break;
    }
  }
  if (lastConnectedTitle) {
    parts.push(`与「${lastConnectedTitle}」有直接关联`);
  }

  // 3. Content snippet signal from vector search text
  if (result.text) {
    const shortText = result.text.replace(/\n+/g, ' ').trim().slice(0, 60);
    if (shortText) {
      parts.push(`内容涉及：${shortText}…`);
    }
  }

  // 4. Fallback
  if (parts.length === 0) {
    parts.push(`与当前探索路径语义相关，综合得分较高`);
  }

  return parts.join('；');
}
