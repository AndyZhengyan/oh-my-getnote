'use client';
import { useGraphStore } from '@/stores/graphStore';
import { Sparkles } from 'lucide-react';

export default function VectorSearchButton() {
  const { multiHopPanelOpen, setMultiHopPanelOpen, browsePath } = useGraphStore();

  return (
    <button
      onClick={() => setMultiHopPanelOpen(!multiHopPanelOpen)}
      title="多跳搜索"
      style={{
        background: multiHopPanelOpen ? 'var(--accent-light)' : 'transparent',
        border: `1px solid ${multiHopPanelOpen ? 'var(--accent-mid)' : 'transparent'}`,
        borderRadius: 6,
        color: browsePath.length > 0 ? 'var(--accent)' : 'var(--text-secondary)',
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
      <Sparkles size={12} />
      {browsePath.length > 0 && (
        <span style={{
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: 10,
          padding: '0 5px',
          fontSize: 10,
          fontWeight: 700,
        }}>
          {browsePath.length}
        </span>
      )}
    </button>
  );
}
