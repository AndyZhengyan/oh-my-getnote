// web/components/toolbar/Toolbar.tsx
'use client';

import { useGraphStore } from '@/stores/graphStore';
import { triggerGraphReset } from '@/stores/graphStore';
import { RotateCcw } from 'lucide-react';
export default function Toolbar() {
  const {
    graphIndex,
    selectNode,
    highlightedTrailId,
    stopTrailPlayback,
  } = useGraphStore();

  const handleReset = () => {
    selectNode(null);
    triggerGraphReset();
  };

  const stats = graphIndex?.stats;
  const totalNotes = stats?.total_notes ?? 0;
  const totalConnections = stats?.total_connections ?? 0;

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
        borderRadius: 'var(--radius-lg)',
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

      {/* Stats */}
      <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {totalNotes} 篇 · {totalConnections} 条关联
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Controls */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {highlightedTrailId && (
          <button
            onClick={stopTrailPlayback}
            title="停止轨迹高亮"
            style={{
              background: 'var(--accent-light)',
              border: '1px solid var(--accent-mid)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent)',
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
            停止高亮
          </button>
        )}

        <button
          onClick={handleReset}
          title="重置视图"
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 'var(--radius-md)',
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
