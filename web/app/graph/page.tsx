// web/app/graph/page.tsx
'use client';

import { useEffect } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { loadGraphIndex } from '@/lib/api';
import Toolbar from '@/components/toolbar/Toolbar';
import LeftNav from '@/components/panels/LeftNav';
import RightPanel from '@/components/panels/RightPanel';
import ForceGraph from '@/components/graph/ForceGraph';

export default function GraphPage() {
  const { setGraphIndex, loaded, graphIndex } = useGraphStore();

  useEffect(() => {
    if (!loaded) {
      loadGraphIndex()
        .then(setGraphIndex)
        .catch(err => console.error('Failed to load graph:', err));
    }
  }, [loaded, setGraphIndex]);

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

  return (
    <main style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Toolbar />
      <LeftNav />
      {/* 图谱画布区域：点阵背景 */}
      <div style={{
        marginLeft: 308,
        height: 'calc(100vh - 14px)',
        backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        backgroundPosition: '14px 78px',
      }}>
        <ForceGraph />
      </div>
      <RightPanel />
    </main>
  );
}
