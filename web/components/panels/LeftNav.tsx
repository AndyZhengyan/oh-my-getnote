// web/components/panels/LeftNav.tsx
'use client';

import { useState } from 'react';
import { useGraphStore, type TrailStep, type GraphIndex } from '@/stores/graphStore';
import { Bookmark, Trash2, ChevronUp, ChevronLeft, ChevronRight, Search, Layers, Save } from 'lucide-react';
import { motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Tag tree node renderer
// ---------------------------------------------------------------------------

interface TagNode {
  label: string;
  count: number;
  tagCount: number;
  children?: TagNode[];
}

function TagNodeItem({
  node,
  depth,
  parentPath,
  tagTreeFilter,
  tagTreeExpanded,
  setTagTreeFilter,
  setTagTreeExpanded,
}: {
  node: TagNode;
  depth: number;
  parentPath?: string;
  tagTreeFilter: string;
  tagTreeExpanded: Set<string>;
  setTagTreeFilter: (f: string) => void;
  setTagTreeExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const fullPath = parentPath ? `${parentPath} › ${node.label}` : node.label;
  const indent = depth === 0 ? 16 : 16 + depth * 16;
  const hasChildren = !!node.children && node.children.length > 0;
  const isExpanded = tagTreeExpanded.has(fullPath);
  const isActive = tagTreeFilter === fullPath || (hasChildren && tagTreeFilter.startsWith(fullPath + ' › '));

  function toggleExpand() {
    setTagTreeExpanded(prev => {
      const next = new Set(prev);
      isExpanded ? next.delete(fullPath) : next.add(fullPath);
      return next;
    });
  }

  function handleClick() {
    if (hasChildren) toggleExpand();
    else setTagTreeFilter(isActive ? '' : fullPath);
  }

  const childNodes = hasChildren
    ? [...node.children!].sort((a, b) => a.label === '其他' ? 1 : b.label === '其他' ? -1 : 0)
    : [];

  return (
    <>
      {/* Row */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: depth === 0 ? '4px 12px 4px 16px' : `3px 12px 3px ${indent}px`,
        gap: 4, cursor: hasChildren ? 'pointer' : 'default',
        background: isActive ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
      }}
        onClick={handleClick}
        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-muted)'; }}
        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        {hasChildren ? (
          <ChevronUp size={11}
            style={{
              color: 'var(--text-muted)', flexShrink: 0,
              transition: 'transform 0.2s',
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(180deg)',
            }}
          />
        ) : (
          <span style={{ width: 11, flexShrink: 0 }} />
        )}
        <span style={{
          fontSize: 12,
          color: isActive ? 'var(--accent)' : 'var(--text-secondary',
          fontWeight: 400,
          flex: 1, fontFamily: 'var(--font-ui)',
        }}>
          {node.label}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{node.tagCount}</span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && childNodes.map(child => (
        <TagNodeItem
          key={child.label}
          node={child}
          depth={depth + 1}
          parentPath={fullPath}
          tagTreeFilter={tagTreeFilter}
          tagTreeExpanded={tagTreeExpanded}
          setTagTreeFilter={setTagTreeFilter}
          setTagTreeExpanded={setTagTreeExpanded}
        />
      ))}
    </>
  );
}

// TagTreeList renders the L0 → L1 tree without using an IIFE in JSX
function TagTreeList({
  graphIndex,
  tagTreeFilter,
  tagTreeExpanded,
  setTagTreeFilter,
  setTagTreeExpanded,
}: {
  graphIndex: GraphIndex;
  tagTreeFilter: string;
  tagTreeExpanded: Set<string>;
  setTagTreeFilter: (f: string) => void;
  setTagTreeExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const l0Node = graphIndex.stats.tagTree[0];
  if (!l0Node) return null;
  const sortedChildren = [...(l0Node.children ?? [])]
    .sort((a, b) => a.label === '其他' ? 1 : b.label === '其他' ? -1 : 0);
  return (
    <>
      {sortedChildren.map(l1Node => (
        <TagNodeItem
          key={l1Node.label}
          node={l1Node}
          depth={0}
          parentPath=""
          tagTreeFilter={tagTreeFilter}
          tagTreeExpanded={tagTreeExpanded}
          setTagTreeFilter={setTagTreeFilter}
          setTagTreeExpanded={setTagTreeExpanded}
        />
      ))}
    </>
  );
}

export default function LeftNav() {
  const {
    graphIndex,
    typeFilter, setTypeFilter,
    tagTreeFilter, setTagTreeFilter,
    browsePath,
    removeFromBrowsePath,
    savedTrails,
    deleteTrail, saveTrail,
    previewNode, setRightPanelOpen,
    leftNavOpen, setLeftNavOpen,
    searchModalOpen, setSearchModalOpen,
  } = useGraphStore();

  const [trailCollapsed, setTrailCollapsed] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useState(false);
  const [typeCollapsed, setTypeCollapsed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [tagTreeExpanded, setTagTreeExpanded] = useState<Set<string>>(new Set());
  const [savingTrail, setSavingTrail] = useState(false);

  // 获取当前时间戳，格式：xxxx/xx/xx_xx:xx
  function getTimestamp(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}_${hh}:${min}`;
  }

  // 基于轨迹节点标题自动生成名称
  async function generateTrailName(nodeIds: string[]): Promise<string> {
    const titles = nodeIds
      .map(id => graphIndex?.index[id]?.title)
      .filter(Boolean) as string[];

    if (titles.length === 0) {
      return `${getTimestamp()}_探索路径`;
    }

    const prompt = `请为以下探索路径生成一个简短的中文名称（不超过10个字），概括这系列笔记的主题：
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

只需输出名称，不要其他内容。`;

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId: nodeIds[0],
          title: titles[0],
          content: titles.join(' | '),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const name = data.summary?.replace(/^["""]|["""]$/g, '').trim();
        if (name && name.length <= 15) {
          return `${getTimestamp()}_${name}`;
        }
      }
    } catch {
      // AI 不可用时使用默认名称
    }

    return `${getTimestamp()}_探索路径`;
  }

  // 保存轨迹
  async function handleSaveTrail() {
    if (!browsePath.length || savingTrail) return;
    setSavingTrail(true);
    try {
      const name = await generateTrailName(browsePath);
      saveTrail(name);
    } finally {
      setSavingTrail(false);
    }
  }

  if (!graphIndex) return null;

  const types = Object.keys(graphIndex.stats.by_type);

  // Total unique tags from L0 root's tagCount
  const totalTags = graphIndex.stats.tagTree[0]?.tagCount ?? 0;

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
          <div style={{ marginBottom: 14 }}>
            <img src="/images/logo.png" alt="Oh My Getnote" style={{ width: 32, height: 32, display: 'block' }} />
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
            <img src="/images/logo.png" alt="Oh My Getnote" style={{ width: 28, height: 28, display: 'block', flexShrink: 0 }} />
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
            {types.length > 0 && (
              <>
                {/* 笔记类型 section header */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 6px 16px', flexShrink: 0, gap: 6 }}>
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
                    {/* 全部笔记 — resets all filters */}
                    <NavItem
                      active={!typeFilter}
                      onClick={() => { setTypeFilter(''); setTagTreeFilter(''); }}
                      color="#9CA3AF"
                      count={graphIndex.stats.total_notes}
                      label="全部笔记"
                    />

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

            {/* Tags section header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 6px 16px', flexShrink: 0, gap: 6 }}>
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
                {/* 全部笔记 — resets all filters */}
                <NavItem
                  active={!tagTreeFilter}
                  onClick={() => { setTagTreeFilter(''); setTypeFilter(''); }}
                  color="#9CA3AF"
                  count={totalTags}
                  label="全部标签"
                />

                <TagTreeList
                  graphIndex={graphIndex}
                  tagTreeFilter={tagTreeFilter}
                  tagTreeExpanded={tagTreeExpanded}
                  setTagTreeFilter={setTagTreeFilter}
                  setTagTreeExpanded={setTagTreeExpanded}
                />
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
                <Bookmark size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-ui)', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                <button
                  onClick={handleSaveTrail}
                  disabled={!browsePath.length || savingTrail}
                  title={savingTrail ? '生成名称中...' : '保存轨迹'}
                  style={{
                    background: 'none', border: 'none', cursor: browsePath.length && !savingTrail ? 'pointer' : 'default',
                    color: browsePath.length ? (savingTrail ? 'var(--accent)' : 'var(--text-muted)') : 'var(--border)', padding: 2, display: 'flex', borderRadius: 3, flexShrink: 0,
                  }}
                  onMouseEnter={e => { if (browsePath.length && !savingTrail) { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = browsePath.length ? (savingTrail ? 'var(--accent)' : 'var(--text-muted)') : 'var(--border)'; }}
                >
                  <Save size={12} />
                </button>
              </div>

              {!trailCollapsed && (
                <div style={{ flex: 1, maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {browsePath.length === 0 && (
                    <div style={{
                      padding: '10px 16px 6px',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <span style={{ fontSize: 16, opacity: 0.4 }}>🧭</span>
                      <span style={{ textAlign: 'center', lineHeight: 1.5 }}>点击图谱节点<br />开始追踪</span>
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
                      onClick={() => useGraphStore.getState().previewNode(nodeId)}
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
                <div style={{ padding: '2px 0 6px', maxHeight: 80, overflowY: 'auto' }}>
                  {savedTrails.length === 0 && (
                    <div style={{
                      padding: '6px 16px',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      lineHeight: 1.5,
                    }}>
                      暂无保存的轨迹<br />
                      <span style={{ opacity: 0.6 }}>点击上方保存按钮归档</span>
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
                      if (ids.length === 0) return;
                      // If current browsePath has content, confirm before overwriting
                      if (browsePath.length > 0) {
                        if (!window.confirm('加载此历史轨迹将覆盖当前探索轨迹，确定继续吗？')) return;
                      }
                      // Load the trail: set browsePath and select the last node
                      // NOTE: Do NOT call selectNode here because selectNode APPENDS
                      // to browsePath. Since we already set browsePath, calling
                      // selectNode would duplicate the last node (e.g. [A,B,C] -> [A,B,C,C]).
                      useGraphStore.setState({ browsePath: ids, selectedNodeId: ids[ids.length - 1], rightPanelOpen: true });
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
