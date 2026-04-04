// web/components/toolbar/Toolbar.tsx
'use client';

import { useGraphStore } from '@/stores/graphStore';
import { triggerGraphReset } from '@/stores/graphStore';
import { Search, Route, RotateCcw } from 'lucide-react';

export default function Toolbar() {
  const {
    graphIndex, domainFilter, typeFilter, searchQuery,
    setDomainFilter, setTypeFilter, setSearchQuery,
    trailRecording, startTrail, saveTrail, finishTrail,
    selectNode,
  } = useGraphStore();

  const handleTrailClick = () => {
    if (trailRecording) {
      const name = window.prompt(
        '保存探索轨迹名称：',
        `探索 ${new Date().toLocaleDateString('zh-CN')}`
      );
      if (name !== null && name.trim()) {
        saveTrail(name.trim());
      }
      // Cancel prompt → discard (don't save)
      else if (name !== null) {
        finishTrail();
      }
      // If user cancels the browser prompt → do nothing, stay recording
    } else {
      startTrail();
    }
  };

  const handleReset = () => {
    selectNode(null);
    triggerGraphReset();
  };

  const domains = graphIndex?.domains ?? [];
  const types = Object.keys(graphIndex?.stats.by_type ?? {});

  const filteredStats = (() => {
    if (!graphIndex) return null;
    const q = (searchQuery || '').toLowerCase();
    let count = 0;
    let connections = 0;
    for (const [, entry] of Object.entries(graphIndex.index)) {
      if (domainFilter && entry.domain !== domainFilter) continue;
      if (typeFilter && entry.type !== typeFilter) continue;
      if (q && !entry.title.toLowerCase().includes(q) && !entry.bodyPreview?.toLowerCase().includes(q)) continue;
      count++;
      connections += entry.connections.length;
    }
    return { count, connections };
  })();

  return (
    <header
      style={{
        position: 'fixed',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        height: 52,
        width: '90vw',
        maxWidth: 1200,
        minWidth: 320,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 14px',
        zIndex: 100,
        whiteSpace: 'nowrap',
      }}
    >
      {/* Logo */}
      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.01em', flexShrink: 0 }}>
        📚 Oh My Getnote
      </span>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* Search */}
      <div style={{ flex: '1 1 200px', minWidth: 120 }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
          />
          <input
            type="search"
            placeholder="搜索标题、内容、标签…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.04)',
              border: '1px solid transparent',
              borderRadius: 6,
              color: 'var(--text-primary)',
              padding: '5px 10px 5px 32px',
              fontSize: 13,
              fontFamily: 'var(--font-ui)',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => {
              e.target.style.borderColor = 'var(--border-focus)';
              e.target.style.boxShadow = '0 0 0 3px var(--accent-light)';
              e.target.style.background = '#fff';
            }}
            onBlur={e => {
              e.target.style.borderColor = 'transparent';
              e.target.style.boxShadow = 'none';
              e.target.style.background = 'rgba(0,0,0,0.04)';
            }}
          />
        </div>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 4 }}>
        <select
          value={domainFilter}
          onChange={e => setDomainFilter(e.target.value)}
          style={{
            background: 'rgba(0,0,0,0.04)',
            border: '1px solid transparent',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            padding: '4px 6px',
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">领域</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            background: 'rgba(0,0,0,0.04)',
            border: '1px solid transparent',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            padding: '4px 6px',
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">类型</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Stats */}
      {filteredStats && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {filteredStats.count} 篇 · {filteredStats.connections} 条关联
        </span>
      )}

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* Controls */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          onClick={handleTrailClick}
          style={{
            background: trailRecording ? 'var(--accent-light)' : 'transparent',
            border: `1px solid ${trailRecording ? 'var(--accent-mid)' : 'transparent'}`,
            borderRadius: 6,
            color: trailRecording ? 'var(--accent)' : 'var(--text-secondary)',
            padding: '4px 10px',
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.12s',
          }}
        >
          <Route size={12} />
          {trailRecording ? '结束' : '轨迹'}
        </button>

        <button
          onClick={handleReset}
          title="重置视图"
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            padding: '4px 8px',
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.12s',
          }}
        >
          <RotateCcw size={12} />
          重置
        </button>
      </div>
    </header>
  );
}
