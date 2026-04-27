// web/components/graph/Tooltip.tsx
'use client';

import type { TooltipState } from './types';

interface TooltipProps {
  tooltip: TooltipState | null;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function Tooltip({ tooltip }: TooltipProps) {
  if (!tooltip) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: tooltip.x + 14,
        top: tooltip.y - 10,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        padding: '10px 14px',
        maxWidth: 260,
        zIndex: 300,
        pointerEvents: 'none',
      }}
    >
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
