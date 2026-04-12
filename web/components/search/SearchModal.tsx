// web/components/search/SearchModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useGraphStore } from '@/stores/graphStore';
import { Search, X } from 'lucide-react';

export default function SearchModal() {
  const { graphIndex, searchModalOpen, setSearchModalOpen, selectNode, setRightPanelOpen } = useGraphStore();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
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
    } else {
      setQuery('');
      setResults([]);
      setTypeFilter('');
    }
  }, [searchModalOpen]);

  // Search logic with 300ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

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
    selectNode(noteId);
    setRightPanelOpen(true);
    setSearchModalOpen(false);
  };

  const handleClose = () => setSearchModalOpen(false);

  const types = Object.keys(graphIndex?.stats.by_type ?? {});

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
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
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
                <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>没有找到匹配的笔记</div>
              )}
              {!query && (
                <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>输入关键词开始搜索</div>
              )}
              {results.map(note => (
                <div key={note.id} onClick={() => handleSelect(note.id)}
                  style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 5, lineHeight: 1.4 }}>
                    {note.title.length > 60 ? note.title.slice(0, 59) + '…' : note.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
                    {note.type}
                    {note.createdAt ? ` · ${note.createdAt}` : ''}
                  </div>
                  {note.bodyPreview && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {note.bodyPreview}
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
