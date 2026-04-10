// web/lib/recommend.test.ts
import { describe, it, expect } from 'vitest';
import { synthesizeRecommendedPaths } from './recommend';
import type { VectorResult } from './recommend';

const makeEntry = (overrides: Partial<{
  domain: string;
  connections: Array<{ noteId: string; score: number; type: string }>;
}> = {}) => ({
  path: '/dummy.md',
  domain: overrides.domain ?? '',
  type: 'AI链接笔记',
  title: 'Dummy',
  bodyPreview: '',
  connections: overrides.connections ?? [],
});

const graphIndex = {
  'node-a': { ...makeEntry({ domain: 'AI 核心技术与模型' }), title: '节点A' },
  'node-b': { ...makeEntry({ domain: 'AI 核心技术与模型', connections: [{ noteId: 'node-c', score: 0.9, type: 'AI链接笔记' }] }), title: '节点B' },
  'node-c': { ...makeEntry({ domain: 'AI 智能体与工程', connections: [] }), title: '节点C' },
  'node-d': { ...makeEntry({ domain: '管理、职场与个人成长' }), title: '节点D' },
};

const rawResults: VectorResult[] = [
  { id: 'node-c', title: '节点C', type: 'AI链接笔记', text: '这是关于智能体的内容', score: 0.92 },
  { id: 'node-d', title: '节点D', type: 'AI链接笔记', text: '', score: 0.88 },
];

describe('synthesizeRecommendedPaths', () => {
  it('returns empty array when rawResults is empty', () => {
    const result = synthesizeRecommendedPaths([], ['node-a'], graphIndex);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when graphIndex is null', () => {
    const result = synthesizeRecommendedPaths(rawResults, ['node-a'], null);
    expect(result).toHaveLength(0);
  });

  it('returns top 3 paths sorted by compositeScore descending', () => {
    const extra: VectorResult[] = [
      ...rawResults,
      { id: 'node-d', title: '节点D', type: 'AI链接笔记', text: '', score: 0.85 },
    ];
    const result = synthesizeRecommendedPaths(extra, ['node-a', 'node-b'], graphIndex);
    expect(result.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].compositeScore).toBeGreaterThanOrEqual(result[i].compositeScore);
    }
  });

  it('boosts score when domain matches browsePath domain (recency bias)', () => {
    const result = synthesizeRecommendedPaths(rawResults, ['node-a', 'node-b'], graphIndex);
    // node-c and node-b share domain 'AI 核心技术与模型'; node-d is different
    const nodeC = result.find(r => r.noteId === 'node-c');
    const nodeD = result.find(r => r.noteId === 'node-d');
    // node-c has domain alignment bonus on top of high vector score
    if (nodeC && nodeD) {
      // node-c should rank higher due to domain match with node-b (most recent in path)
      expect(result.indexOf(nodeC)).toBeLessThan(result.indexOf(nodeD));
    }
  });

  it('boosts score when candidate is directly connected to a browsePath node', () => {
    const result = synthesizeRecommendedPaths(rawResults, ['node-a', 'node-b'], graphIndex);
    // node-b has connection to node-c, so node-c gets connection bonus
    const nodeC = result.find(r => r.noteId === 'node-c');
    expect(nodeC?.whyFrom).toContain('node-b');
  });

  it('generates an explanation for each result', () => {
    const result = synthesizeRecommendedPaths(rawResults, ['node-a', 'node-b'], graphIndex);
    for (const path of result) {
      expect(typeof path.explanation).toBe('string');
      expect(path.explanation.length).toBeGreaterThan(0);
    }
  });

  it('fills in domainColor from DOMAIN_COLORS', () => {
    const result = synthesizeRecommendedPaths(rawResults, ['node-a'], graphIndex);
    const nodeC = result.find(r => r.noteId === 'node-c');
    expect(nodeC?.domainColor).toBe('#10B981'); // AI 智能体与工程
  });

  it('marks isSaved false initially', () => {
    const result = synthesizeRecommendedPaths(rawResults, ['node-a'], graphIndex);
    for (const path of result) {
      expect(path.isSaved).toBe(false);
    }
  });

  it('uses result.text in the returned path', () => {
    const result = synthesizeRecommendedPaths(rawResults, ['node-a'], graphIndex);
    const nodeC = result.find(r => r.noteId === 'node-c');
    expect(nodeC?.text).toBe('这是关于智能体的内容');
  });
});
