// web/components/search/SearchModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useGraphStore } from '@/stores/graphStore';
import { Search, X } from 'lucide-react';

export default function SearchModal() {
  const { graphIndex, searchModalOpen, setSearchModalOpen } = useGraphStore();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modalTop, setModalTop] = useState<number>(0);
  const [results, setResults] = useState<Array<{
    id: string; title: string; type: string;
    bodyPreview: string; createdAt?: string; tags?: string[];
  }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (searchModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchModalOpen]);

  // Compute modal top position: 40% down from viewport top
  useEffect(() => {
    setModalTop(typeof window !== 'undefined' ? window.innerHeight * 0.4 : 0);
    const onResize = () => setModalTop(typeof window !== 'undefined' ? window.innerHeight * 0.4 : 0);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Search logic with 300ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) return;

    debounceRef.current = setTimeout(() => {
      if (!graphIndex) return;
      const q = query.toLowerCase();
      const matched: typeof results = [];

      for (const [id, entry] of Object.entries(graphIndex.index)) {
        if (typeFilter && entry.type !== typeFilter) continue;
        if (
          entry.title.toLowerCase().includes(q) ||
          entry.bodyPreview?.toLowerCase().includes(q) ||
          entry.tags?.some(t => t.toLowerCase().includes(q))
        ) {
          matched.push({
            id,
            title: entry.title,
            type: entry.type ?? '',
            bodyPreview: entry.bodyPreview ?? '',
            createdAt: entry.createdAt,
            tags: entry.tags,
          });
        }
        if (matched.length >= 10) break;
      }
      setResults(matched);
    }, 300);
  }, [query, typeFilter, graphIndex]);

  const handleSelect = (noteId: string) => {
    // Read current browsePath atomically and update in a single set() call,
    // matching the graph click (ForceGraph.handleNodeClick) behavior where
    // selectNode is the sole state writer for browsePath. Using two separate
    // store actions (selectNode + setRightPanelOpen) here risks the
    // browsePath update being isolated from the panel open flag.
    const { browsePath, selectedNodeId } = useGraphStore.getState();
    useGraphStore.setState({
      selectedNodeId: noteId,
      browsePath: noteId === selectedNodeId ? browsePath : [...browsePath, noteId],
      rightPanelOpen: true,
    });
    setSearchModalOpen(false);
  };

  const handleClose = () => setSearchModalOpen(false);

  const types = Array.from(
    new Set(Object.values(graphIndex?.index ?? {}).map((e) => e.type).filter(Boolean))
  ).sort();

  const modalContent = (
    <AnimatePresence>
      {searchModalOpen && (
        <>
          {/* Backdrop — 全局模糊遮罩 */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 500,
            }}
          />
          {/* Modal — 页面中上居中，大尺寸（wrapper 负责居中，motion.div 只负责动画避免 transform 冲突） */}
          <div
            style={{
              position: 'fixed', top: modalTop, left: '50%',
              transform: 'translate(-50%, 0)',
              width: 640,
              zIndex: 510,
            }}
          >
            <motion.div
              initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{
                width: 640,
                maxHeight: '72vh',
                background: 'rgba(255,255,255,0.98)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 14,
                boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}
            >
            {/* Search bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
              <Search size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="搜索标题、内容、标签…" autoFocus
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, fontFamily: 'var(--font-ui)', color: 'var(--text-primary)', background: 'transparent' }}
                onKeyDown={e => { if (e.key === 'Escape') handleClose(); }}
              />
              {typeFilter && (
                <button onClick={() => { setTypeFilter(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, padding: '2px 8px', borderRadius: 6 }}>
                  清除
                </button>
              )}
              <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', borderRadius: 6 }}>
                <X size={17} />
              </button>
            </div>

            {/* Filter chips */}
            {types.length > 0 && (
              <div style={{ display: 'flex', gap: 6, padding: '6px 18px 10px', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                {types.slice(0, 8).map(t => (
                  <button key={t} onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
                    style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-ui)', border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
                      borderColor: typeFilter === t ? 'var(--accent)' : 'rgba(0,0,0,0.1)',
                      background: typeFilter === t ? 'var(--accent-light)' : 'rgba(0,0,0,0.03)',
                      color: typeFilter === t ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* Results */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {query && results.length === 0 && (
                <div style={{ padding: '36px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24, opacity: 0.3 }}>🔍</span>
                  <span style={{ lineHeight: 1.5 }}>没有找到匹配的笔记<br /><span style={{ opacity: 0.6, fontSize: 11 }}>尝试更换关键词或筛选条件</span></span>
                </div>
              )}
              {!query && (
                <div style={{ padding: '36px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24, opacity: 0.25 }}>💡</span>
                  <span style={{ lineHeight: 1.5 }}>输入关键词开始搜索<br /><span style={{ opacity: 0.6, fontSize: 11 }}>支持标题、内容和标签搜索</span></span>
                </div>
              )}
              {results.map(note => (
                <div key={note.id} onClick={() => handleSelect(note.id)}
                  style={{ padding: '12px 18px', borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'background 0.12s', display: 'flex', flexDirection: 'column', gap: 4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.04)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {note.type && (
                      <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(99,102,241,0.1)', color: '#6366F1', padding: '1px 7px', borderRadius: 10, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
                        {note.type}
                      </span>
                    )}
                    {note.createdAt && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{note.createdAt}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {note.title.length > 60 ? note.title.slice(0, 59) + '…' : note.title}
                  </div>
                  {note.bodyPreview && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {note.bodyPreview}
                    </div>
                  )}
                  {note.tags && note.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                      {note.tags.slice(0, 4).map(tag => (
                        <span key={tag} style={{ fontSize: 10, background: 'rgba(0,0,0,0.04)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 8 }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
