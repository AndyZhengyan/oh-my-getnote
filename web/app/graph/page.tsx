// web/app/graph/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { loadGraphIndex } from '@/lib/api';
import Toolbar from '@/components/toolbar/Toolbar';
import LeftNav from '@/components/panels/LeftNav';
import RightPanel from '@/components/panels/RightPanel';
import ForceGraph from '@/components/graph/ForceGraph';

export default function GraphPage() {
  const loaded = useGraphStore((s) => s.loaded);
  const graphIndex = useGraphStore((s) => s.graphIndex);
  const setGraphIndex = useGraphStore((s) => s.setGraphIndex);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const loadTrails = useGraphStore((s) => s.loadTrails);
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

  return (
    <main style={{
      background: 'var(--bg-base)',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <Toolbar />
      <LeftNav />
      {/* 图谱画布区域：点阵背景 */}
      <div style={{
        position: 'fixed',
        top: 78,
        left: 308,
        right: 16,
        bottom: 16,
        backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        backgroundPosition: '14px 78px',
        overflow: 'hidden',
        borderRadius: 'var(--radius-lg)',
      }}>
        <ForceGraph />
      </div>
      <RightPanel />
    </main>
  );
}
