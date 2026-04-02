// web/components/panels/LeftNav.tsx
'use client';

import { useState, useEffect } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { Bookmark } from 'lucide-react';

const DOMAIN_COLORS: Record<string, string> = {
  'AI 核心技术与模型':   '#2563EB',
  'AI 产业生态与巨头':  '#7C3AED',
  'AI 智能体与工程':    '#00F5FF',
  '管理、职场与个人成长': '#D97706',
  '行业应用与生活闲谈': '#DB2777',
  '企业数字化与数据治理': '#0284C7',
  '社会、安全与伦理':  '#7C22CE',
  '其他':               '#6B7280',
};

interface Trail {
  id: string;
  name: string;
  createdAt: string;
  steps: { noteId: string }[];
}

export default function LeftNav() {
  const { graphIndex, domainFilter, setDomainFilter, typeFilter, setTypeFilter } = useGraphStore();
  const [showTrails, setShowTrails] = useState(false);
  const [trails, setTrails] = useState<Trail[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('memex_trails');
      if (stored) setTrails(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  if (!graphIndex) return null;

  const types = Object.keys(graphIndex.stats.by_type);

  return (
    <aside style={{
      width: 280,
      height: 'calc(100vh - 52px)',
      position: 'fixed',
      top: 52,
      left: 0,
      background: 'rgba(22,27,34,0.6)',
      borderRight: '1px solid var(--border-dim)',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 全部笔记 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '12px 16px 6px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          知识领域
        </div>

        <NavItem
          active={domainFilter === '' && typeFilter === ''}
          onClick={() => { setDomainFilter(''); setTypeFilter(''); }}
          color="#fff"
          count={graphIndex.stats.total_notes}
          label="全部笔记"
        />

        {graphIndex.domains.map(domain => (
          <NavItem
            key={domain}
            active={domainFilter === domain}
            onClick={() => setDomainFilter(domainFilter === domain ? '' : domain)}
            color={DOMAIN_COLORS[domain] ?? '#6B7280'}
            count={graphIndex.stats.by_domain[domain] ?? 0}
            label={domain}
          />
        ))}

        {types.length > 0 && (
          <>
            <div style={{ padding: '12px 16px 6px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              笔记类型
            </div>
            {types.map(type => (
              <NavItem
                key={type}
                active={typeFilter === type}
                onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
                color="var(--text-secondary)"
                count={graphIndex.stats.by_type[type]}
                label={type}
              />
            ))}
          </>
        )}
      </div>

      {/* 轨迹历史 */}
      <div style={{ borderTop: '1px solid var(--border-dim)', padding: '8px 0' }}>
        <button
          onClick={() => setShowTrails(!showTrails)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            color: showTrails ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <Bookmark size={13} />
          探索轨迹 ({trails.length})
        </button>

        {showTrails && (
          <div>
            {trails.length === 0 && (
              <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                暂无轨迹记录
              </div>
            )}
            {trails.slice(0, 10).map(trail => (
              <div key={trail.id} style={{
                padding: '6px 16px 6px 32px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                borderLeft: '2px solid transparent',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = 'var(--primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent'; }}
              >
                {trail.name}
                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                  {trail.steps.length}步
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function NavItem({
  active, onClick, color, count, label,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  count: number;
  label: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '7px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        background: active ? 'rgba(0,245,255,0.08)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--text-secondary)',
        fontSize: 13,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0,
        opacity: active ? 1 : 0.7,
      }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
        {count}
      </span>
    </div>
  );
}
