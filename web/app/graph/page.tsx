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
      }}>
        加载中…
      </div>
    );
  }

  return (
    <main>
      <Toolbar />
      <LeftNav />
      <div style={{
        marginLeft: 280,
        marginTop: 52,
        height: 'calc(100vh - 52px)',
      }}>
        <ForceGraph />
      </div>
      <RightPanel />
    </main>
  );
}
