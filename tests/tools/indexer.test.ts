import { describe, it, expect } from 'vitest';
import { buildGraphIndex, NoteIndexEntry } from '../../tools/indexer.js';

const mockEntries: NoteIndexEntry[] = [
  {
    id: 'note-001',
    path: 'notes/录音笔记/note-001.md',
    domain: 'AI 智能体与工程',
    type: '录音笔记',
    title: 'AI Agent 设计模式',
    connections: [{ noteId: 'note-002', score: 0.92, type: 'semantic' }],
  },
  {
    id: 'note-002',
    path: 'notes/AI链接笔记/note-002.md',
    domain: 'AI 核心技术与模型',
    type: 'AI链接笔记',
    title: 'GPT-4 能力分析',
    connections: [
      { noteId: 'note-001', score: 0.92, type: 'semantic' },
      { noteId: 'note-003', score: 0.78, type: 'explicit' },
    ],
  },
  {
    id: 'note-003',
    path: 'notes/录音笔记/note-003.md',
    domain: 'AI 智能体与工程',
    type: '录音笔记',
    title: '第二篇',
    connections: [],
  },
];

describe('buildGraphIndex', () => {
  it('生成包含 stats.total_notes 的索引', () => {
    const index = buildGraphIndex(mockEntries);
    expect(index.stats.total_notes).toBe(3);
  });

  it('统计 total_connections（双向计入）', () => {
    const index = buildGraphIndex(mockEntries);
    // note-001: 1条, note-002: 2条, note-003: 0条
    expect(index.stats.total_connections).toBe(3);
  });

  it('by_domain 统计正确', () => {
    const index = buildGraphIndex(mockEntries);
    expect(index.stats.by_domain['AI 智能体与工程']).toBe(2);
    expect(index.stats.by_domain['AI 核心技术与模型']).toBe(1);
  });

  it('by_type 统计正确', () => {
    const index = buildGraphIndex(mockEntries);
    expect(index.stats.by_type['录音笔记']).toBe(2);
    expect(index.stats.by_type['AI链接笔记']).toBe(1);
  });

  it('index 映射包含 path/domain/type/title/connections', () => {
    const index = buildGraphIndex(mockEntries);
    const entry = index.index['note-001'];
    expect(entry.path).toBe('notes/录音笔记/note-001.md');
    expect(entry.domain).toBe('AI 智能体与工程');
    expect(entry.type).toBe('录音笔记');
    expect(entry.title).toBe('AI Agent 设计模式');
    expect(entry.connections).toHaveLength(1);
    expect(entry.connections[0].noteId).toBe('note-002');
  });

  it('version 字段为 "1.0"', () => {
    const index = buildGraphIndex(mockEntries);
    expect(index.version).toBe('1.0');
  });

  it('generated_at 为 ISO 格式时间戳', () => {
    const index = buildGraphIndex(mockEntries);
    expect(index.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('domains 数组不重复', () => {
    const index = buildGraphIndex(mockEntries);
    const domains = index.domains;
    const unique = new Set(domains);
    expect(domains.length).toBe(unique.size);
  });

  it('空 entries 返回正确的空结构', () => {
    const index = buildGraphIndex([]);
    expect(index.stats.total_notes).toBe(0);
    expect(index.stats.total_connections).toBe(0);
    expect(index.stats.by_domain).toEqual({});
    expect(index.stats.by_type).toEqual({});
    expect(index.index).toEqual({});
  });
});
