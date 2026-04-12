// web/app/graph/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { loadGraphIndex } from '@/lib/api';
import LeftNav from '@/components/panels/LeftNav';
import RightPanel from '@/components/panels/RightPanel';
import SearchModal from '@/components/search/SearchModal';
import ForceGraph from '@/components/graph/ForceGraph';

export default function GraphPage() {
  const loaded = useGraphStore((s) => s.loaded);
  const graphIndex = useGraphStore((s) => s.graphIndex);
  const setGraphIndex = useGraphStore((s) => s.setGraphIndex);
  const loadTrails = useGraphStore((s) => s.loadTrails);
  const rightPanelOpen = useGraphStore((s) => s.rightPanelOpen);
  const selectNode = useGraphStore((s) => s.selectNode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) {
      loadGraphIndex()
        .then(index => {
          setGraphIndex(index);
          loadTrails();
        })
        .catch(err => {
          console.error('Failed to load graph:', err);
          setError('加载图谱失败，请刷新页面重试');
        });
    }
  }, [loaded, setGraphIndex, loadTrails]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#EF4444', fontSize: 14, background: 'var(--bg-base)' }}>
        {error}
      </div>
    );
  }

  if (!loaded || !graphIndex) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontSize: 14, background: 'var(--bg-base)' }}>
        加载中…
      </div>
    );
  }

  return (
    <main style={{ background: 'var(--bg-base)', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Three-column flex layout */}
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <LeftNav />

        {/* 中间画布 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          margin: '0 7px',
          overflow: 'hidden',
        }}>
          {/* Graph area */}
          <div style={{
            flex: 1,
            backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            backgroundPosition: '14px 14px',
            overflow: 'hidden',
            borderRadius: 'var(--radius-lg)',
            position: 'relative',
          }}>
            <ForceGraph />
          </div>

          {/* Bottom status bar */}
          <div style={{
            flexShrink: 0,
            height: 36,
            display: 'flex', alignItems: 'center',
            padding: '0 14px',
            gap: 12,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            marginTop: 7,
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              {graphIndex.stats.total_notes} 篇 · {graphIndex.stats.total_connections} 条关联
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => selectNode(null)}
              title="重置"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, fontFamily: 'var(--font-ui)', padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-muted)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              重置
            </button>
          </div>
        </div>

        {/* RightPanel — flex controlled width */}
        <div style={{
          flexShrink: 0,
          flex: rightPanelOpen ? 1.2 : 0,
          width: rightPanelOpen ? 'auto' : 0,
          maxWidth: rightPanelOpen ? 800 : 0,
          transition: 'flex 0.25s ease-out, width 0.25s ease-out, maxWidth 0.25s ease-out',
          overflow: 'hidden',
          display: 'flex',
        }}>
          {rightPanelOpen && <RightPanel />}
        </div>
      </div>
      <SearchModal />
    </main>
  );
}
