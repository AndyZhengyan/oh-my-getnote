'use client';
import { useState } from 'react';
import { useGraphStore } from '@/stores/graphStore';

export default function MultiHopPanel() {
  const {
    multiHopIds, multiHopPanelOpen, setMultiHopIds, removeMultiHopId, graphIndex, selectNode,
  } = useGraphStore();
  const [results, setResults] = useState<Array<{ id: string; title: string; type: string; score: number }>>([]);
  const [loading, setLoading] = useState(false);

  if (!multiHopPanelOpen) return null;

  const selectedNotes = multiHopIds
    .map(id => graphIndex?.index[id])
    .filter(Boolean);

  const handleSearch = async () => {
    if (multiHopIds.length === 0) return;
    setLoading(true);
    try {
      const texts = selectedNotes.map(n => `${(n as { title: string }).title}`);
      const res = await fetch('/api/vector/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, limit: 10, excludeIds: multiHopIds }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 66,
      right: 16,
      width: 340,
      maxHeight: 'calc(100vh - 80px)',
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 16,
      zIndex: 200,
      boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>&#x1f52e; 多跳搜索</span>
        <button onClick={handleSearch} disabled={multiHopIds.length === 0 || loading}
          style={{
            fontSize: 12, padding: '4px 10px',
            background: multiHopIds.length > 0 && !loading ? 'var(--accent)' : 'var(--bg-elevated)',
            color: multiHopIds.length > 0 && !loading ? '#fff' : 'var(--text-muted)',
            border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}>
          {loading ? '搜索中…' : '\u{1F50D} 搜索'}
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>当前组合（点击移除）：</div>
        {multiHopIds.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>从图谱选中笔记加入</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {selectedNotes.map((n, i) => n && (
              <div key={multiHopIds[i]} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 8px', background: 'var(--bg-elevated)',
                border: '1px solid var(--border)', borderRadius: 6, fontSize: 12,
                cursor: 'pointer',
              }}>
                <span
                  style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onClick={() => selectNode(multiHopIds[i])}>
                  &#x1f517; {(n as { title: string }).title}
                </span>
                <button onClick={() => removeMultiHopId(multiHopIds[i])}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '0 0 0 8px' }}>
                  &#x2715;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setMultiHopIds([])}
          style={{
            fontSize: 12, padding: '4px 10px', background: 'transparent',
            border: '1px solid var(--border)', color: 'var(--text-secondary)',
            borderRadius: 4, cursor: 'pointer',
          }}>
          清空
        </button>
      </div>

      {results.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>推荐结果：</div>
          {results.map(r => (
            <div key={r.id} style={{
              padding: '6px 8px', marginBottom: 4,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: 6,
              cursor: 'pointer', fontSize: 12,
            }} onClick={() => selectNode(r.id)}>
              <div style={{ color: 'var(--text-primary)', marginBottom: 2 }}>&#x1f4c4; {r.title}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.type} · {(r.score * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
