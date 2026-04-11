// web/app/graph/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { loadGraphIndex } from '@/lib/api';
import Toolbar from '@/components/toolbar/Toolbar';
import LeftNav from '@/components/panels/LeftNav';
import RightPanel from '@/components/panels/RightPanel';
import ForceGraph from '@/components/graph/ForceGraph';
import SearchModal from '@/components/search/SearchModal';

export default function GraphPage() {
  const loaded = useGraphStore((s) => s.loaded);
  const graphIndex = useGraphStore((s) => s.graphIndex);
  const setGraphIndex = useGraphStore((s) => s.setGraphIndex);
  const loadTrails = useGraphStore((s) => s.loadTrails);
  const leftNavOpen = useGraphStore((s) => s.leftNavOpen);
  const rightPanelOpen = useGraphStore((s) => s.rightPanelOpen);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) {
      loadGraphIndex()
        .then(index => {
          setGraphIndex(index);
          loadTrails(); // Restore saved trails from localStorage
        })
        .catch(err => {
          console.error('Failed to load graph:', err);
          setError('加载图谱失败，请刷新页面重试');
        });
    }
  }, [loaded, setGraphIndex, loadTrails]);

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: '#EF4444', fontSize: 14,
        background: 'var(--bg-base)',
      }}>
        {error}
      </div>
    );
  }

  if (!loaded || !graphIndex) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--text-muted)', fontSize: 14,
        background: 'var(--bg-base)',
      }}>
        加载中…
      </div>
    );
  }

  // Push-pull layout: LeftNav collapses → graph expands; RightPanel opens → graph shrinks
  const leftNavWidth = leftNavOpen ? 280 + 7 + 7 : 60 + 7 + 7; // width + left/right margin
  const rightPanelWidth = rightPanelOpen ? 380 + 14 : 0;

  return (
    <main style={{
      background: 'var(--bg-base)',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <Toolbar />

      {/* Flex row: LeftNav + Graph + (RightPanel overlays graph) */}
      <div style={{
        display: 'flex',
        height: 'calc(100vh - 78px)',
        marginTop: 78,
        overflow: 'hidden',
      }}>
        <LeftNav />

        {/* 图谱画布区域：点阵背景，flex:1 自动填满剩余空间 */}
        <div style={{
          flex: 1,
          marginRight: rightPanelOpen ? 0 : 14,
          marginBottom: 7,
          marginTop: 0,
          backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          backgroundPosition: '14px 14px',
          overflow: 'hidden',
          borderRadius: 'var(--radius-lg)',
          position: 'relative',
        }}>
          <ForceGraph />
        </div>
      </div>

      {/* RightPanel: fixed overlay, left edge tracks LeftNav width */}
      <div style={{
        position: 'fixed',
        top: 78,
        left: leftNavWidth,
        right: 0,
        bottom: 0,
        pointerEvents: rightPanelOpen ? 'auto' : 'none',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: rightPanelWidth,
          height: '100%',
          transition: 'width 0.25s ease-out',
          overflow: 'hidden',
        }}>
          <RightPanel panelLeft={leftNavWidth} />
        </div>
      </div>

      <SearchModal />
    </main>
  );
}
