// web/components/panels/LeftNav.tsx
'use client';

import { useState } from 'react';
import { useGraphStore, type TrailStep } from '@/stores/graphStore';
import { Bookmark, Trash2, ChevronUp, ChevronLeft, ChevronRight, Search, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
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
    leftNavOpen, setLeftNavOpen,
    searchModalOpen, setSearchModalOpen,
  } = useGraphStore();

  const [trailCollapsed, setTrailCollapsed] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useState(false);
  const [typeCollapsed, setTypeCollapsed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);

  if (!graphIndex) return null;

  const types = Object.keys(graphIndex.stats.by_type);

  const NAV_WIDTH = 280;
  const COLLAPSED_WIDTH = 48;

  return (
    <motion.aside
      animate={{ width: leftNavOpen ? NAV_WIDTH : COLLAPSED_WIDTH }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        height: 'calc(100vh - 14px)',
        position: 'relative',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        flexShrink: 0,
        margin: '7px 0 7px 7px',
      }}
    >
      {/* Toggle button — always visible */}
      <button
        onClick={() => setLeftNavOpen(!leftNavOpen)}
        title={leftNavOpen ? '收起侧边栏' : '展开侧边栏'}
        style={{
          position: 'absolute',
          top: 12,
          right: 10,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 4,
          display: 'flex',
          borderRadius: 4,
          zIndex: 10,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
      >
        {leftNavOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Collapsed state: Logo + vertical icon buttons */}
      {!leftNavOpen && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 0,
          paddingTop: 8,
        }}>
          {/* Logo */}
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
            📚
          </div>
          {/* Search icon */}
          <button
            onClick={() => setSearchModalOpen(true)}
            title="搜索笔记"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 6, display: 'flex', borderRadius: 6,
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--accent)'; el.style.background = 'var(--accent-light)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-muted)'; el.style.background = 'transparent'; }}
          >
            <Search size={18} />
          </button>
          {/* Layers icon — expand on click */}
          <button
            onClick={() => setLeftNavOpen(true)}
            title="展开侧边栏"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 6, display: 'flex', borderRadius: 6,
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--accent)'; el.style.background = 'var(--accent-light)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-muted)'; el.style.background = 'transparent'; }}
          >
            <Layers size={18} />
          </button>
          {/* Bookmark icon — expand on click */}
          <button
            onClick={() => setLeftNavOpen(true)}
            title="展开侧边栏"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 6, display: 'flex', borderRadius: 6,
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--accent)'; el.style.background = 'var(--accent-light)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-muted)'; el.style.background = 'transparent'; }}
          >
            <Bookmark size={18} />
          </button>
        </div>
      )}

      {/* Full content — only visible when expanded */}
      {leftNavOpen && (
        <>
          {/* Logo row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>📚</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
              Oh My Getnote
            </span>
          </div>

          {/* Search trigger button */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px',
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
            onClick={() => setSearchModalOpen(true)}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-muted)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              点击搜索笔记…
            </span>
          </div>

          {/* Domain list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
            {/* Tags / 知识领域 section header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 6px 16px', flexShrink: 0, gap: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, flex: 1 }}>
                Tags
              </span>
              <button
                onClick={() => setTagsCollapsed(c => !c)}
                title={tagsCollapsed ? '展开' : '收起'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', borderRadius: 3, flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                <ChevronUp size={12} style={{ transition: 'transform 0.2s', transform: tagsCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }} />
              </button>
            </div>

            {!tagsCollapsed && (
              <>
                <NavItem
                  active={domainFilter === '' && typeFilter === ''}
                  onClick={() => { setDomainFilter(''); setTypeFilter(''); }}
                  color="#9CA3AF"
                  count={graphIndex.stats.total_notes}
                  label="全部笔记"
                />

                {graphIndex.domains
                  .filter(d => d !== '其他')
                  .sort((a, b) => (graphIndex.stats.by_domain[b] ?? 0) - (graphIndex.stats.by_domain[a] ?? 0))
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
              </>
            )}

            {types.length > 0 && (
              <>
                {/* 笔记类型 section header */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 6px 16px', flexShrink: 0, gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, flex: 1 }}>
                    笔记类型
                  </span>
                  <button
                    onClick={() => setTypeCollapsed(c => !c)}
                    title={typeCollapsed ? '展开' : '收起'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', borderRadius: 3, flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                  >
                    <ChevronUp size={12} style={{ transition: 'transform 0.2s', transform: typeCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }} />
                  </button>
                </div>

                {!typeCollapsed && (
                  <>
                    {types
                      .filter(t => t !== '其他')
                      .sort((a, b) => (graphIndex.stats.by_type[b] ?? 0) - (graphIndex.stats.by_type[a] ?? 0))
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
              </>
            )}
          </div>

          {/* Bottom: 探索路径 + 历史轨迹 */}
          <div style={{
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
          }}>

            {/* 探索路径 section */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px 6px 16px', flexShrink: 0, gap: 6 }}>
                <Bookmark size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-ui)', color: 'var(--accent)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  探索路径 ({browsePath.length})
                </span>
                <button
                  onClick={() => setTrailCollapsed(c => !c)}
                  title={trailCollapsed ? '展开' : '收起'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 2, display: 'flex', borderRadius: 3, flexShrink: 0,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                >
                  <ChevronUp size={12} style={{ transition: 'transform 0.2s', transform: trailCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }} />
                </button>
              </div>

              {!trailCollapsed && (
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {browsePath.length === 0 && (
                    <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      点击图谱节点开始追踪
                    </div>
                  )}
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
              )}
            </div>

            {/* 历史轨迹 section */}
            <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              {/* 历史轨迹 section header */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px 4px 16px', flexShrink: 0, gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, flex: 1 }}>
                  历史轨迹
                </span>
                <button
                  onClick={() => setHistoryCollapsed(c => !c)}
                  title={historyCollapsed ? '展开' : '收起'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', borderRadius: 3, flexShrink: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                >
                  <ChevronUp size={12} style={{ transition: 'transform 0.2s', transform: historyCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }} />
                </button>
              </div>

              {!historyCollapsed && (
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
              )}
            </div>
          </div>
        </>
      )}
    </motion.aside>
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
