// web/components/panels/LeftNav.tsx
'use client';

import { useState, useEffect } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { Bookmark, Square } from 'lucide-react';

/** 英文字母序优先，其余按 localeCompare 排的 comparator */
function compareAlphaFirst(a: string, b: string): number {
  const aIsEN = /^[A-Za-z]/.test(a);
  const bIsEN = /^[A-Za-z]/.test(b);
  if (aIsEN && !bIsEN) return -1;
  if (!aIsEN && bIsEN) return 1;
  return a.localeCompare(b, 'zh-CN');
}

const DOMAIN_COLORS: Record<string, string> = {
  'AI 核心技术与模型':   '#6366F1',
  'AI 产业生态与巨头':  '#8B5CF6',
  'AI 智能体与工程':    '#10B981',
  '管理、职场与个人成长': '#F59E0B',
  '行业应用与生活闲谈': '#EC4899',
  '企业数字化与数据治理': '#3B82F6',
  '社会、安全与伦理':  '#A855F7',
  '其他':               '#9CA3AF',
};

export default function LeftNav() {
  const { graphIndex, domainFilter, setDomainFilter, typeFilter, setTypeFilter, playTrail, highlightedTrailId, savedTrails, loadTrails, stopTrailPlayback } = useGraphStore();
  const [showTrails, setShowTrails] = useState(false);

  // Ensure store's savedTrails is populated on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTrails(); }, []);

  if (!graphIndex) return null;

  const types = Object.keys(graphIndex.stats.by_type);

  return (
    <aside style={{
      width: 280,
      height: 'calc(100vh - 14px)',
      position: 'fixed',
      top: 78,
      left: 14,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
    }}>
      {/* Domain list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        <div style={{ padding: '0 16px 6px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          知识领域
        </div>

        <NavItem
          active={domainFilter === '' && typeFilter === ''}
          onClick={() => { setDomainFilter(''); setTypeFilter(''); }}
          color="#9CA3AF"
          count={graphIndex.stats.total_notes}
          label="全部笔记"
        />

        {graphIndex.domains
          .filter(d => d !== '其他')
          .sort(compareAlphaFirst)
          .map(domain => (
            <NavItem
              key={domain}
              active={domainFilter === domain}
              onClick={() => setDomainFilter(domainFilter === domain ? '' : domain)}
              color={DOMAIN_COLORS[domain] ?? '#9CA3AF'}
              count={graphIndex.stats.by_domain[domain] ?? 0}
              label={domain}
            />
          ))}

        {graphIndex.domains.includes('其他') && (
          <NavItem
            active={domainFilter === '其他'}
            onClick={() => setDomainFilter(domainFilter === '其他' ? '' : '其他')}
            color={DOMAIN_COLORS['其他'] ?? '#9CA3AF'}
            count={graphIndex.stats.by_domain['其他'] ?? 0}
            label="其他"
          />
        )}

        {types.length > 0 && (
          <>
            <div style={{ padding: '12px 16px 6px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              笔记类型
            </div>
            {types
              .filter(t => t !== '其他')
              .sort(compareAlphaFirst)
              .map(type => (
                <NavItem
                  key={type}
                  active={typeFilter === type}
                  onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
                  color="var(--text-secondary)"
                  count={graphIndex.stats.by_type[type]}
                label={type}
              />
            ))}

            {types.includes('其他') && (
              <NavItem
                active={typeFilter === '其他'}
                onClick={() => setTypeFilter(typeFilter === '其他' ? '' : '其他')}
                color="var(--text-secondary)"
                count={graphIndex.stats.by_type['其他']}
                label="其他"
              />
            )}
          </>
        )}
      </div>

      {/* Trail history */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 0', flexShrink: 0 }}>
        {/* Stop button — shown while a trail is highlighted */}
        {highlightedTrailId && (
          <div style={{ padding: '4px 16px 4px' }}>
            <button
              onClick={stopTrailPlayback}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
              }}
            >
              <Square size={10} fill="currentColor" />
              停止高亮
            </button>
          </div>
        )}

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
            color: showTrails ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 13,
            fontFamily: 'var(--font-ui)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'color 0.12s',
          }}
        >
          <Bookmark size={13} />
          探索轨迹 ({savedTrails.length})
        </button>

        {showTrails && (
          <div>
            {savedTrails.length === 0 && (
              <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                暂无轨迹记录
              </div>
            )}
            {savedTrails.slice(0, 10).map(trail => {
              const isActive = highlightedTrailId === trail.id;
              return (
                <div key={trail.id} style={{
                  padding: '6px 16px 6px 32px',
                  fontSize: 12,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  transition: 'background 0.15s, color 0.15s, border-left-color 0.15s',
                  fontFamily: 'var(--font-ui)',
                }}
                onClick={() => playTrail(trail.id)}
                onMouseEnter={e => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.borderLeftColor = 'var(--accent)'; el.style.color = 'var(--accent)'; } }}
                onMouseLeave={e => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.borderLeftColor = 'transparent'; el.style.color = 'var(--text-secondary)'; } }}
                >
                  {trail.name}
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                    {trail.steps.length}步
                  </span>
                </div>
              );
            })}
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
        background: active ? 'var(--accent-light)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: 13,
        fontFamily: 'var(--font-ui)',
        transition: 'background 0.12s, color 0.12s',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-muted)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
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
