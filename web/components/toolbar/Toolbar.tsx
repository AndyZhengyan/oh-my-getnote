// web/components/toolbar/Toolbar.tsx
'use client';

import { useGraphStore } from '@/stores/graphStore';
import { Search, Route } from 'lucide-react';

export default function Toolbar() {
  const {
    graphIndex, domainFilter, typeFilter, searchQuery,
    setDomainFilter, setTypeFilter, setSearchQuery, startTrail, trailRecording,
  } = useGraphStore();

  const domains = graphIndex?.domains ?? [];
  const types = Object.keys(graphIndex?.stats.by_type ?? {});

  return (
    <header
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 52,
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-dim)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        zIndex: 100,
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', color: '#fff' }}>
        📚 Memex
      </span>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 360 }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
          />
          <input
            type="search"
            placeholder="搜索笔记标题、内容、标签…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid var(--border-dim)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              padding: '5px 12px 5px 32px',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={domainFilter}
          onChange={e => setDomainFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid var(--border-dim)',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            padding: '5px 8px',
            fontSize: 12,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">全部领域</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid var(--border-dim)',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            padding: '5px 8px',
            fontSize: 12,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">全部类型</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Stats */}
      {graphIndex && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {graphIndex.stats.total_notes} 篇 · {graphIndex.stats.total_connections} 条关联
        </span>
      )}

      {/* Trail button */}
      <button
        onClick={startTrail}
        style={{
          background: trailRecording ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${trailRecording ? 'rgba(0,245,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 6,
          color: trailRecording ? 'var(--primary)' : 'var(--text-secondary)',
          padding: '5px 10px',
          fontSize: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Route size={12} />
        {trailRecording ? '记录中…' : '轨迹'}
      </button>
    </header>
  );
}
