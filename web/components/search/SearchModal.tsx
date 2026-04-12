// web/components/search/SearchModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGraphStore } from '@/stores/graphStore';
import { Search, X } from 'lucide-react';

export default function SearchModal() {
  const { graphIndex, searchModalOpen, setSearchModalOpen, selectNode, setRightPanelOpen } = useGraphStore();
  const [query, setQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [results, setResults] = useState<Array<{
    id: string; title: string; domain: string; type: string;
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
      setDomainFilter('');
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
        if (domainFilter && entry.domain !== domainFilter) continue;
        if (typeFilter && entry.type !== typeFilter) continue;
        if (
          entry.title.toLowerCase().includes(q) ||
          entry.bodyPreview?.toLowerCase().includes(q) ||
          entry.tags?.some(t => t.toLowerCase().includes(q))
        ) {
          matched.push({
            id,
            title: entry.title,
            domain: entry.domain ?? '',
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
  }, [query, domainFilter, typeFilter, graphIndex]);

  const handleSelect = (noteId: string) => {
    selectNode(noteId);
    setRightPanelOpen(true);
    setSearchModalOpen(false);
  };

  const handleClose = () => setSearchModalOpen(false);

  const domains = graphIndex?.domains ?? [];
  const types = Object.keys(graphIndex?.stats.by_type ?? {});

  return (
    <AnimatePresence>
      {searchModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 500 }}
          />
          {/* Modal */}
          <motion.div
            initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              position: 'fixed', top: 80, left: '50%',
              transform: 'translateX(-50%)',
              width: 420, maxHeight: 'calc(100vh - 120px)',
              background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 510,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Search bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="搜索标题、内容、标签…" autoFocus
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--text-primary)', background: 'transparent' }}
                onKeyDown={e => { if (e.key === 'Escape') handleClose(); }}
              />
              {(domainFilter || typeFilter) && (
                <button onClick={() => { setDomainFilter(''); setTypeFilter(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>
                  清除
                </button>
              )}
              <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', borderRadius: 4 }}>
                <X size={15} />
              </button>
            </div>

            {/* Filter chips */}
            {domains.length > 0 && (
              <div style={{ display: 'flex', gap: 6, padding: '8px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                {domains.slice(0, 6).map(d => (
                  <button key={d} onClick={() => setDomainFilter(domainFilter === d ? '' : d)}
                    style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontFamily: 'var(--font-ui)', border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
                      borderColor: domainFilter === d ? 'var(--accent)' : 'var(--border)',
                      background: domainFilter === d ? 'var(--accent-light)' : 'transparent',
                      color: domainFilter === d ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {d}
                  </button>
                ))}
              </div>
            )}

            {/* Results */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {query && results.length === 0 && (
                <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>没有找到匹配的笔记</div>
              )}
              {!query && (
                <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>输入关键词开始搜索</div>
              )}
              {results.map(note => (
                <div key={note.id} onClick={() => handleSelect(note.id)}
                  style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-muted)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
                    {note.title.length > 50 ? note.title.slice(0, 49) + '…' : note.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {[note.domain, note.type].filter(Boolean).join(' · ')}
                    {note.createdAt ? ` · ${note.createdAt}` : ''}
                  </div>
                  {note.bodyPreview && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {note.bodyPreview}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
