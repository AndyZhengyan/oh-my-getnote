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
  type: string;
  title: string;
  bodyPreview?: string;
  connections: Array<{ noteId: string; score: number; type: string }>;
}

/**
 * Synthesize top-3 recommended paths from vector search results + graph context.
 *
 * Scoring: 70% vector similarity + 30% direct connection bonus.
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

/** Composite score = 70% vector similarity + 30% connection bonus */
function computeCompositeScore(
  result: VectorResult,
  browsePath: string[],
  graphIndex: Record<string, GraphIndexEntry>,
): CompositeScore {
  const VECTOR_WEIGHT = 0.70;
  const CONN_WEIGHT = 0.30;

  const vectorScore = result.score;
  const { score: connScore, nodes: contributingNodes } = computeConnectionBonus(
    result.id,
    browsePath,
    graphIndex,
  );

  return {
    total: vectorScore * VECTOR_WEIGHT + connScore * CONN_WEIGHT,
    contributingNodes,
  };
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

  // 1. Direct connection explanation — mention most recent connected node
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

  // 2. Content snippet signal from vector search text
  if (result.text) {
    const shortText = result.text.replace(/\n+/g, ' ').trim().slice(0, 60);
    if (shortText) {
      parts.push(`内容涉及：${shortText}…`);
    }
  }

  // 3. Fallback
  if (parts.length === 0) {
    parts.push(`与当前探索路径语义相关，综合得分较高`);
  }

  return parts.join('；');
}
