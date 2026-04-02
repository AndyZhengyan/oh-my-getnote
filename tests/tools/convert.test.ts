import { describe, it, expect } from 'vitest';
import { inferDomain } from '../../tools/convert.js';

describe('inferDomain', () => {
  it('包含 AI/LLM/GPT 标签推断为 AI 核心技术', () => {
    expect(inferDomain(['录音笔记', 'AI智能体', 'LLM'])).toBe('AI 核心技术与模型');
    expect(inferDomain(['AI链接笔记', 'GPT-4'])).toBe('AI 核心技术与模型');
  });

  it('包含 智能体/Agent 标签推断为 AI 智能体', () => {
    expect(inferDomain(['录音笔记', 'AI智能体'])).toBe('AI 智能体与工程');
    expect(inferDomain(['AI链接笔记', 'Agent架构'])).toBe('AI 智能体与工程');
  });

  it('包含 管理/职场/成长 标签推断为管理职场', () => {
    expect(inferDomain(['录音笔记', '管理心理学'])).toBe('管理、职场与个人成长');
    expect(inferDomain(['AI链接笔记', '职场晋升'])).toBe('管理、职场与个人成长');
    expect(inferDomain(['录音笔记', '个人成长'])).toBe('管理、职场与个人成长');
  });

  it('无匹配标签默认为 其他', () => {
    expect(inferDomain(['录音笔记', '日常'])).toBe('其他');
    expect(inferDomain(['录音笔记'])).toBe('其他');
  });
});
