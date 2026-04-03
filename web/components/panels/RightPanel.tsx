// web/components/panels/RightPanel.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { loadNote, NoteContent } from '@/lib/note';
import { X, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';

const DOMAIN_COLORS: Record<string, string> = {
  'AI 核心技术与模型':   '#2563EB',
  'AI 产业生态与巨头':  '#7C3AED',
  'AI 智能体与工程':    '#00F5FF',
  '管理、职场与个人成长': '#D97706',
  '行业应用与生活闲谈': '#DB2777',
  '企业数字化与数据治理': '#0284C7',
  '社会、安全与伦理':  '#7C22CE',
  '其他':               '#6B7280',
};

export default function RightPanel() {
  const { selectedNodeId, graphIndex, selectNode, focusMode, setFocusMode } = useGraphStore();
  const [note, setNote] = useState<NoteContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!selectedNodeId || !graphIndex) { setNote(null); setAiSummary(null); return; }
    const entry = graphIndex.index[selectedNodeId];
    if (!entry) return;
    const cached = localStorage.getItem(`ai_summary_${selectedNodeId}`);
    if (cached) setAiSummary(cached);
    setLoading(true);
    loadNote(entry.path).then(n => {
      setNote(n);
      if (n?.frontmatter.ai_summary) {
        setAiSummary(n.frontmatter.ai_summary);
        localStorage.setItem(`ai_summary_${selectedNodeId}`, n.frontmatter.ai_summary);
      }
      setLoading(false);
    });
  }, [selectedNodeId, graphIndex]);

  const handleAISummary = useCallback(async () => {
    if (!selectedNodeId || !note?.body || !graphIndex) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: selectedNodeId, title: note.frontmatter.title, content: note.body }),
      });
      const data = await res.json();
      if (data.summary) {
        setAiSummary(data.summary);
        localStorage.setItem(`ai_summary_${selectedNodeId}`, data.summary);
        await fetch('/api/notes/update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: graphIndex.index[selectedNodeId].path, frontmatter: { ...note.frontmatter, ai_summary: data.summary } }),
        });
      }
    } catch (err) { console.error('AI summary failed:', err); }
    finally { setAiLoading(false); }
  }, [selectedNodeId, note, graphIndex]);

  if (!selectedNodeId || !graphIndex) return null;
  const entry = graphIndex.index[selectedNodeId];
  if (!entry) return null;

  return (
    <AnimatePresence>
      <motion.aside
        key="right-panel"
        initial={{ x: 380, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 380, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={{ position: 'fixed', right: 16, top: 64, width: 360, maxHeight: 'calc(100vh - 80px)', background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', border: '1px solid var(--border-dim)', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.5)', overflowY: 'auto', zIndex: 200, display: 'flex', flexDirection: 'column' }}
      >
        {focusMode && (
          <div style={{ padding: '8px 16px', background: 'rgba(0,245,255,0.08)', borderBottom: '1px solid rgba(0,245,255,0.15)', fontSize: 11, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>🧭 聚焦模式 · 右键节点展开关联</span>
            <button onClick={() => setFocusMode(false)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11 }}>退出聚焦</button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid var(--border-dim)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8, color: '#fff' }}>{entry.title}</h3>
          <button onClick={() => selectNode(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
        </div>
        <div style={{ padding: '10px 16px 6px', borderBottom: '1px solid var(--border-dim)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{entry.type} · {entry.domain}</div>
          {note?.frontmatter.tags && note.frontmatter.tags.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {note.frontmatter.tags.slice(1).map(tag => (
                <span key={tag} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-dim)', borderRadius: 4, padding: '1px 7px', fontSize: 11, color: 'var(--text-secondary)' }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
        {(aiSummary || aiLoading) && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-dim)', background: 'rgba(0,245,255,0.04)' }}>
            <div style={{ fontSize: 10, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>✨ AI 摘要</div>
            {aiLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}><Loader2 size={12} />生成中…</div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{aiSummary}</div>
            )}
          </div>
        )}
        <div style={{ padding: '12px 16px', flex: 1 }}>
          {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}><Loader2 size={16} style={{ display: 'block', margin: '0 auto 8px' }} />加载中…</div>}
          {!loading && note?.body && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body}</ReactMarkdown></div>}
          {!loading && !note?.body && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>（无正文内容）</div>}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-dim)' }}>
          {!aiSummary && !aiLoading && (
            <button onClick={handleAISummary} style={{ width: '100%', padding: '7px 12px', background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.3)', borderRadius: 8, color: 'var(--primary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
              <Sparkles size={13} />✨ AI 摘要
            </button>
          )}
          {entry.connections.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>相似笔记 ({entry.connections.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {entry.connections.slice(0, 10).map(conn => {
                  const target = graphIndex.index[conn.noteId];
                  if (!target) return null;
                  return (
                    <div key={conn.noteId} onClick={() => selectNode(conn.noteId)} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: `2px solid ${DOMAIN_COLORS[target.domain] ?? '#6B7280'}` }} title={target.title}>
                      {target.title}<span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>{Math.round(conn.score * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
