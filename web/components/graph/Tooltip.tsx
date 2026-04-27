// web/components/graph/Tooltip.tsx
'use client';

import type { TooltipState } from './types';

interface TooltipProps {
  tooltip: TooltipState | null;
  pinned?: boolean;
  rank?: number;
  onClick?: () => void;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function Tooltip({ tooltip, pinned, rank, onClick }: TooltipProps) {
  if (!tooltip) return null;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: tooltip.x + 14,
        top: tooltip.y - 10,
        background: pinned ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${pinned ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: pinned ? '0 4px 16px rgba(0,0,0,0.1)' : 'var(--shadow-md)',
        padding: '10px 14px',
        maxWidth: 260,
        zIndex: pinned ? 290 : 300,
        pointerEvents: pinned ? 'auto' : 'none',
        cursor: pinned ? 'pointer' : undefined,
        transition: pinned ? 'box-shadow 0.15s' : undefined,
      }}
      onMouseEnter={pinned ? e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.18)'; } : undefined}
      onMouseLeave={pinned ? e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; } : undefined}
    >
      {pinned && rank != null && (
        <div style={{
          fontSize: 9, color: 'var(--accent)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2,
        }}>
          推荐 #{rank}
        </div>
      )}
      <div style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
        marginBottom: 5, letterSpacing: '-0.01em', lineHeight: 1.3,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {tooltip.title}
      </div>
      {(tooltip.type || tooltip.createdAt) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
          fontSize: 11, fontFamily: 'var(--font-ui)',
        }}>
          {tooltip.type && (
            <span style={{
              padding: '1px 6px', borderRadius: 3,
              background: 'var(--accent-light)',
              color: 'var(--accent)', fontWeight: 500,
            }}>
              {tooltip.type}
            </span>
          )}
          {tooltip.createdAt && (
            <span style={{ color: 'var(--text-muted)' }}>
              {formatDate(tooltip.createdAt)}
            </span>
          )}
        </div>
      )}
      {tooltip.snippet && (
        <div style={{
          fontSize: 11, color: 'var(--text-secondary)',
          lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>
          {tooltip.snippet}
        </div>
      )}
    </div>
  );
}
