// web/components/graph/ClearConfirmDialog.tsx
'use client';

import { useCallback } from 'react';
import { useGraphStore } from '@/stores/graphStore';

interface ClearConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ClearConfirmDialog({ isOpen, onClose }: ClearConfirmDialogProps) {
  const clearBrowsePath = useGraphStore((s) => s.clearBrowsePath);
  const clearRecommendedPaths = useGraphStore((s) => s.clearRecommendedPaths);

  const handleConfirm = useCallback(() => {
    clearBrowsePath();
    clearRecommendedPaths();
    onClose();
  }, [clearBrowsePath, clearRecommendedPaths, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 400,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '24px 28px',
          zIndex: 410,
          minWidth: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <p style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: 0,
          textAlign: 'center',
          lineHeight: 1.4,
        }}>
          清空当前探索轨迹？
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--bg-muted)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'var(--bg-elevated)'; }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = '#6D28D9'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'var(--accent)'; }}
          >
            确认
          </button>
        </div>
      </div>
    </>
  );
}
