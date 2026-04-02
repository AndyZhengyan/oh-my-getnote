// web/components/panels/RightPanel.tsx
'use client';

import { useGraphStore } from '@/stores/graphStore';
import { X } from 'lucide-react';

export default function RightPanel() {
  const { selectedNodeId, graphIndex, selectNode, focusMode, setFocusMode } = useGraphStore();

  if (!selectedNodeId || !graphIndex) return null;

  const entry = graphIndex.index[selectedNodeId];
  if (!entry) return null;

  return (
    <aside style={{
      position: 'fixed',
      right: 16,
      top: 64,
      width: 360,
      maxHeight: 'calc(100vh - 80px)',
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(20px)',
      border: '1px solid var(--border-dim)',
      borderRadius: 12,
      boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      overflowY: 'auto',
      zIndex: 200,
    }}>
      {focusMode && (
        <div style={{
          padding: '8px 16px',
          background: 'rgba(0,245,255,0.08)',
          borderBottom: '1px solid rgba(0,245,255,0.15)',
          fontSize: 11,
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>🧭 聚焦模式 · 右键节点展开关联</span>
          <button
            onClick={() => setFocusMode(false)}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11 }}
          >
            退出聚焦
          </button>
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 12px',
        borderBottom: '1px solid var(--border-dim)',
      }}>
        <h3 style={{
          fontSize: 14, fontWeight: 600, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          paddingRight: 8, color: '#fff',
        }}>
          {entry.title}
        </h3>
        <button
          onClick={() => selectNode(null)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 2px' }}
        >
          <X size={18} />
        </button>
      </div>
      <div style={{ padding: '12px 16px', fontSize: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          {entry.type} · {entry.domain}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          点击查看笔记正文
        </div>
        {entry.connections.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            相似笔记 ({entry.connections.length})
          </div>
        )}
      </div>
    </aside>
  );
}
