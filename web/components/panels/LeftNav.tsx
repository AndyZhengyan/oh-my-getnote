// web/components/panels/LeftNav.tsx
'use client';

import { useState } from 'react';
import { useGraphStore, type TrailStep } from '@/stores/graphStore';
import { Bookmark, Trash2 } from 'lucide-react';
import { DOMAIN_COLORS } from '@/lib/constants';


/** 英文字母序优先，其余按 localeCompare 排的 comparator */
function compareAlphaFirst(a: string, b: string): number {
  const aIsEN = /^[A-Za-z]/.test(a);
  const bIsEN = /^[A-Za-z]/.test(b);
  if (aIsEN && !bIsEN) return -1;
  if (!aIsEN && bIsEN) return 1;
  return a.localeCompare(b, 'zh-CN');
}

export default function LeftNav() {
  const {
    graphIndex,
    domainFilter, setDomainFilter,
    typeFilter, setTypeFilter,
    browsePath,
    removeFromBrowsePath,
    savedTrails,
    deleteTrail, saveTrail,
    selectNode, setRightPanelOpen,
  } = useGraphStore();



  if (!graphIndex) return null;

  const types = Object.keys(graphIndex.stats.by_type);

  return (
    <aside style={{
      width: 280,
      maxWidth: 280,
      height: 'calc(100vh - 14px)',
      position: 'fixed',
      top: 78,
      left: 14,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      overflow: 'hidden',
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

      {/* Bottom: 3:1 flex sections + 历史轨迹 */}
      <div style={{ borderTop: '1px solid var(--border)', flex: '0 0 auto', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: 280, flexShrink: 0 }}>

        {/* 探索路径 section — flex: 3 */}
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 210, minHeight: 0, borderBottom: '1px solid var(--border)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px 6px 16px', flexShrink: 0, gap: 6 }}>
            <Bookmark size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontFamily: 'var(--font-ui)', color: 'var(--accent)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              探索路径 ({browsePath.length})
            </span>
            {/* 收起按钮 ▲ */}
            <button
                            style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 2, display: 'flex', borderRadius: 3, flexShrink: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
            </button>
          </div>

          {/* Content — independent scroll */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                  点击图谱节点开始追踪
                </div>
              {browsePath.map((nodeId, i) => {
                const entry = graphIndex?.index[nodeId];
                const isLast = i === browsePath.length - 1;
                return (
                  <div key={nodeId} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '5px 12px 5px 28px',
                    fontSize: 12,
                    color: isLast ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    borderLeft: `2px solid ${isLast ? 'var(--accent)' : 'transparent'}`,
                    background: isLast ? 'var(--accent-light)' : 'transparent',
                    fontFamily: 'var(--font-ui)',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onClick={() => useGraphStore.getState().selectNode(nodeId)}
                  onMouseEnter={e => { if (!isLast) { const el = e.currentTarget as HTMLElement; el.style.borderLeftColor = 'var(--accent)'; el.style.color = 'var(--accent)'; } }}
                  onMouseLeave={e => { if (!isLast) { const el = e.currentTarget as HTMLElement; el.style.borderLeftColor = 'transparent'; el.style.color = 'var(--text-secondary)'; } }}
                  >
                    <span style={{ color: 'var(--text-muted)', marginRight: 5, flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry?.title ?? nodeId}
                    </span>
                    <button
                      title="移除此步及后续"
                      onClick={e => { e.stopPropagation(); removeFromBrowsePath(nodeId); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 2, display: 'flex', borderRadius: 3, flexShrink: 0,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
        </div>

        {/* 历史轨迹 section — fixed */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ padding: '4px 16px 2px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            历史轨迹
          </div>
          <div style={{ padding: '2px 0 6px' }}>
            {savedTrails.length === 0 && (
              <div style={{ padding: '4px 16px', fontSize: 11, color: 'var(--text-muted)' }}>
                暂无
              </div>
            )}
            {savedTrails.slice(0, 5).map(trail => (
              <div key={trail.id} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 16px',
                fontSize: 11,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
              onClick={() => {
                const ids = trail.steps.map((s: { noteId: string }) => s.noteId);
                useGraphStore.setState({ browsePath: ids });
                if (ids.length > 0) useGraphStore.getState().selectNode(ids[ids.length - 1]);
              }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trail.name}</span>
                <button onClick={e => { e.stopPropagation(); deleteTrail(trail.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
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
