// Fix markdown: add newlines before block-level syntax that got squashed into one line
function fixMarkdownLineBreaks(body: string): string {
  // Add newlines before common block-level markdown patterns
  // These patterns are detected mid-text when the HTML had no <br> between blocks
  let fixed = body;
  // Headings: ## or # anywhere in text
  fixed = fixed.replace(/(#{1,6}\s)/g, '\n\n$1');
  // HR / list / blockquote at word boundaries
  fixed = fixed.replace(/(\s)(-{3,})/g, '\n\n$2');
  fixed = fixed.replace(/(\s)(={3,})/g, '\n\n$2');
  fixed = fixed.replace(/(\s)([-*+]\s)/g, '\n$2');
  fixed = fixed.replace(/(\s)(\d+\.\s)/g, '\n$2');
  fixed = fixed.replace(/(\s)(>\s)/g, '\n$2');
  fixed = fixed.replace(/(\s)(```)/g, '\n$2');
  // Clean up multiple newlines
  fixed = fixed.replace(/\n{3,}/g, '\n\n');
  return fixed;
}

import { useState, useEffect, useCallback } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { loadNote, NoteContent } from '@/lib/note';
import { X, Sparkles, Loader2, Maximize, Minimize, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { DOMAIN_COLORS } from '@/lib/constants';

// 链路感知推荐算法
function getPathAwareRecommendations(
  browsePath: string[],
  selectedNodeId: string | null,
  graphIndex: { index: Record<string, { connections: Array<{ noteId: string; score: number }>; title?: string; domain?: string }> } | null,
): Array<{ noteId: string; score: number; title: string; domain: string }> {
  if (!graphIndex) return [];

  if (browsePath.length === 0) {
    // 降级: 单节点推荐
    if (!selectedNodeId) return [];
    const conns = graphIndex.index[selectedNodeId]?.connections ?? [];
    return conns.slice(0, 10).map(c => ({
      noteId: c.noteId,
      score: c.score,
      title: graphIndex.index[c.noteId]?.title ?? '',
      domain: graphIndex.index[c.noteId]?.domain ?? '',
    }));
  }

  // 指数衰减加权 (decay=0.7, 近节点权重高，早期节点仍有贡献)
  const DECAY = 0.7;
  const scores: Record<string, number> = {};

  browsePath.forEach((nodeId, i) => {
    const weight = Math.pow(DECAY, browsePath.length - 1 - i);
    const conns = graphIndex.index[nodeId]?.connections ?? [];
    conns.forEach(conn => {
      scores[conn.noteId] = (scores[conn.noteId] ?? 0) + conn.score * weight;
    });
  });

  // 排除已访问节点
  const exclude = new Set(browsePath);
  if (selectedNodeId) exclude.add(selectedNodeId);

  return Object.entries(scores)
    .filter(([noteId]) => !exclude.has(noteId))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([noteId, rawScore]) => ({
      noteId,
      score: rawScore / browsePath.length,
      title: graphIndex.index[noteId]?.title ?? '',
      domain: graphIndex.index[noteId]?.domain ?? '',
    }));
}

interface RightPanelProps {
  panelLeft: number; // left edge of the panel area (tracks LeftNav width)
}

export default function RightPanel({ panelLeft }: RightPanelProps) {
  const { selectedNodeId, graphIndex, selectNode, focusMode, setFocusMode, browsePath, rightPanelOpen, setRightPanelOpen } = useGraphStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [note, setNote] = useState<NoteContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    setAiError(null);
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
      if (!res.ok || data.error) {
        setAiError(data.error ?? 'API error');
        return;
      }
      if (data.summary) {
        setAiSummary(data.summary);
        localStorage.setItem(`ai_summary_${selectedNodeId}`, data.summary);
        await fetch('/api/notes/update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: graphIndex.index[selectedNodeId].path, frontmatter: { ...note.frontmatter, ai_summary: data.summary } }),
        });
      }
    } catch { setAiError('AI 摘要生成失败，请检查网络或 API 配置'); }
    finally { setAiLoading(false); }
  }, [selectedNodeId, note, graphIndex]);

  if (!selectedNodeId || !graphIndex) return null;
  const entry = graphIndex.index[selectedNodeId];
  if (!entry) return null;

  const panelStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'absolute', top: 0, right: 0, bottom: 0,
        left: panelLeft, width: 'auto',
        background: '#fff', border: 'none', borderRadius: 0,
        boxShadow: '-4px 0 20px rgba(0,0,0,0.06)',
        overflowY: 'auto', overflow: 'hidden', zIndex: 300,
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
      }
    : {
        position: 'absolute', top: 0, right: 0,
        left: panelLeft, width: 380,
        maxHeight: '100%',
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: 'none',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.06)',
        overflowY: 'auto', overflow: rightPanelOpen ? 'auto' : 'hidden', zIndex: 200,
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
      };

  return (
    <AnimatePresence>
      <motion.aside
        key={`right-panel-${isFullscreen ? 'fullscreen' : 'normal'}-${panelLeft}`}
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: rightPanelOpen ? 380 : 0, opacity: rightPanelOpen ? 1 : 0 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={panelStyle}
      >
        {/* Focus mode banner */}
        {focusMode && (
          <div style={{ padding: '8px 16px', background: 'var(--accent-light)', borderBottom: '1px solid var(--accent-mid)', fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-ui)' }}>
            <span>🧭 聚焦模式 · 右键节点展开关联</span>
            <button onClick={() => setFocusMode(false)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-ui)' }}>退出聚焦</button>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 18px 12px', borderBottom: '1px solid var(--border)', gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, flex: 1, wordBreak: 'break-word', lineHeight: 1.4, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{entry.title}</h3>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
            <button onClick={() => graphIndex?.archivePath && window.open('/api/source/' + graphIndex.archivePath + '/notes/' + selectedNodeId + '.html', '_blank')} title="打开原地址" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', borderRadius: 'var(--radius-sm)' }}>
              🔗
            </button>
            <button onClick={handleAISummary} disabled={aiLoading} title="AI 摘要" style={{ background: 'none', border: 'none', color: aiLoading ? 'var(--accent)' : 'var(--text-muted)', cursor: aiLoading ? 'default' : 'pointer', padding: '2px 4px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center' }}>
              {aiLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
            </button>
            <button onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? '退出全屏' : '全屏查看'} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', borderRadius: 'var(--radius-sm)' }}>
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
            <button onClick={() => setRightPanelOpen(false)} title="收起" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', borderRadius: 'var(--radius-sm)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div style={{ padding: '10px 18px 8px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{entry.type} · {entry.domain}</div>
          {note?.frontmatter.tags && note.frontmatter.tags.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {note.frontmatter.tags.slice(1).map(tag => (
                <span key={tag} style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* AI Summary */}
        {(aiSummary || aiLoading || aiError) && (
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--accent-light)' }}>
            <div style={{ fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600 }}>✨ AI 摘要</div>
            {aiLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />生成中…
              </div>
            ) : aiError ? (
              <div style={{ fontSize: 12, color: '#EF4444' }}>{aiError}</div>
            ) : (
              <div className="markdown-body" style={{ fontSize: 13 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiSummary}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div style={{ padding: isFullscreen ? '20px 32px' : '14px 18px', flex: 1 }}>
          {loading && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', fontFamily: 'var(--font-ui)' }}>
              <Loader2 size={16} style={{ display: 'block', margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
              加载中…
            </div>
          )}
          {!loading && note?.body && (
            <div className="markdown-body" style={{ fontSize: isFullscreen ? 15 : 13 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{fixMarkdownLineBreaks(note.body)}</ReactMarkdown>
            </div>
          )}
          {!loading && !note?.body && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>（无正文内容）</div>
          )}
        </div>

        {/* Footer: path-aware recommendations */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', fontFamily: 'var(--font-ui)' }}>
          {/* 链路感知推荐 */}
          {(() => {
            const recommendations = getPathAwareRecommendations(
              browsePath ?? [],
              selectedNodeId,
              graphIndex
            );
            if (recommendations.length === 0) return null;
            return (
              <>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600 }}>
                  {browsePath?.length ? '✨ 链路推荐' : '相似笔记'} ({recommendations.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {recommendations.map(rec => (
                    <div key={rec.noteId} onClick={() => selectNode(rec.noteId)} style={{
                      padding: '7px 10px',
                      background: 'rgba(0,0,0,0.03)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      borderLeft: `2px solid ${DOMAIN_COLORS[rec.domain] ?? '#9CA3AF'}`,
                      fontFamily: 'var(--font-ui)',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.03)'; }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {rec.title}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>
                        {Math.round(rec.score * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
