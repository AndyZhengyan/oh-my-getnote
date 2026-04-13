// web/components/graph/Tooltip.tsx
'use client';

import type { TooltipState } from './types';

interface TooltipProps {
  tooltip: TooltipState | null;
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
        maxWidth: 240,
        zIndex: 300,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
        {tooltip.title}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {tooltip.snippet}
      </div>
    </div>
  );
}
