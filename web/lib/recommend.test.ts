// web/lib/recommend.test.ts
import { describe, it, expect } from 'vitest';
import { synthesizeRecommendedPaths } from './recommend';
import type { VectorResult } from './recommend';

const makeEntry = (overrides: Partial<{
  connections: Array<{ noteId: string; score: number; type: string }>;
}> = {}) => ({
  path: '/dummy.md',
  type: 'AI链接笔记',
  title: 'Dummy',
  bodyPreview: '',
  connections: overrides.connections ?? [],
});

const graphIndex = {
  'node-a': { ...makeEntry(), title: '节点A' },
  'node-b': { ...makeEntry({ connections: [{ noteId: 'node-c', score: 0.9, type: 'AI链接笔记' }] }), title: '节点B' },
  'node-c': { ...makeEntry({ connections: [] }), title: '节点C' },
  'node-d': { ...makeEntry(), title: '节点D' },
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
