// web/components/panels/LeftNav.tsx
'use client';

import { useState } from 'react';
import { useGraphStore, type RecommendedPath, type TrailStep } from '@/stores/graphStore';
import { Bookmark, Trash2, X, Sparkles } from 'lucide-react';
import { DOMAIN_COLORS } from '@/lib/constants';
import { synthesizeRecommendedPaths, type VectorResult } from '@/lib/recommend';

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
    browsePath, browsePathShow, setBrowsePathShow,
    clearBrowsePath, removeFromBrowsePath,
    savedTrails,
    deleteTrail, saveTrail,
    selectNode,
    recommendedPaths, setRecommendedPaths, markPathSaved,
  } = useGraphStore();

  const [searching, setSearching] = useState(false);

  const handleVectorSearch = async () => {
    if (browsePath.length === 0) return;
    setSearching(true);
    try {
      const selectedNotes = browsePath.map(id => graphIndex?.index[id]).filter(Boolean);
      const texts = selectedNotes.map(n => (n as { title: string }).title);
      const res = await fetch('/api/vector/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, limit: 10, excludeIds: browsePath }),
      });
      if (!res.ok) { setRecommendedPaths([]); return; }
      const data = await res.json();
      const rawResults: VectorResult[] = data.results ?? [];
      const paths = synthesizeRecommendedPaths(rawResults, browsePath, graphIndex?.index ?? null);
      setRecommendedPaths(paths.map(p => ({ ...p, domainColor: DOMAIN_COLORS[p.domain] ?? '#9CA3AF' })));
    } catch {
      setRecommendedPaths([]);
    } finally {
      setSearching(false);
    }
  };

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
      borderRadius: 'var(--radius-lg)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      overflow: 'hidden auto',
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

      {/* Trail section — browsePath auto-trace */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 0', flexShrink: 0 }}>
        <button
          onClick={() => setBrowsePathShow(!browsePathShow)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            color: browsePathShow ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 13,
            fontFamily: 'var(--font-ui)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'color 0.12s',
          }}
        >
          <Bookmark size={13} />
          探索路径 ({browsePath.length})
          {browsePath.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); clearBrowsePath(); }}
              title="清空轨迹"
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 2,
                display: 'flex',
                borderRadius: 3,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              <X size={12} />
            </span>
          )}
        </button>

        {browsePathShow && (
          <div>
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
                  padding: '6px 16px 6px 32px',
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
                  <span style={{ color: 'var(--text-muted)', marginRight: 6, flexShrink: 0 }}>{i + 1}.</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry?.title ?? nodeId}
                  </span>
                  <button
                    title="移除此步及后续"
                    onClick={e => { e.stopPropagation(); removeFromBrowsePath(nodeId); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: 2,
                      display: 'flex',
                      borderRadius: 3,
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
            {browsePath.length > 0 && (
              <button
                onClick={() => {
                  const date = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
                  saveTrail(`探索 ${date}`);
                }}
                style={{
                  width: 'calc(100% - 32px)',
                  margin: '4px 16px 0',
                  padding: '5px 8px',
                  background: 'var(--accent-light)',
                  border: '1px solid var(--accent-mid)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                保存轨迹
              </button>
            )}

            {/* 多跳搜索 */}
            {browsePath.length > 0 && (
              <>
                <button
                  onClick={handleVectorSearch}
                  disabled={searching}
                  style={{
                    width: 'calc(100% - 32px)',
                    margin: '4px 16px 0',
                    padding: '5px 8px',
                    background: searching ? 'var(--bg-elevated)' : 'var(--accent)',
                    border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius-md)',
                    color: '#fff',
                    fontSize: 12,
                    fontFamily: 'var(--font-ui)',
                    cursor: searching ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    opacity: searching ? 0.6 : 1,
                  }}
                >
                  <Sparkles size={12} />
                  {searching ? '搜索中…' : '多跳搜索'}
                </button>

                {recommendedPaths.length > 0 && (
                  <div style={{ marginTop: 8, padding: '0 16px 4px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      推荐链路
                    </div>
                    {recommendedPaths.map((path, rank) => (
                      <RecommendedPathCard
                        key={path.noteId}
                        path={path}
                        rank={rank + 1}
                        onSelect={() => selectNode(path.noteId)}
                        onSaveTrail={() => {
                          const trailSteps: TrailStep[] = [
                            ...browsePath.map(noteId => ({ noteId, timestamp: new Date().toISOString() })),
                            { noteId: path.noteId, timestamp: new Date().toISOString() },
                          ];
                          const date = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
                          saveTrail(`推荐路线 ${date}`, trailSteps);
                          markPathSaved(path.noteId);
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 历史轨迹 */}
        <div style={{ padding: '4px 16px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          历史轨迹
        </div>
        <div style={{ padding: '4px 0' }}>
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
    </aside>
  );
}

function RecommendedPathCard({
  path, rank, onSelect, onSaveTrail,
}: {
  path: RecommendedPath;
  rank: number;
  onSelect: () => void;
  onSaveTrail: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rankBgColors = ['#6366F1', '#8B5CF6', '#10B981'];
  const rankBg = rankBgColors[rank - 1] ?? '#9CA3AF';

  return (
    <div style={{ marginBottom: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', fontFamily: 'var(--font-ui)' }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: expanded ? 'rgba(0,0,0,0.02)' : 'transparent', transition: 'background 0.12s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = expanded ? 'rgba(0,0,0,0.02)' : 'transparent'; }}
      >
        <span style={{ width: 18, height: 18, borderRadius: 4, background: rankBg, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {rank}
        </span>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: path.domainColor, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {path.title}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
          {(path.compositeScore * 100).toFixed(0)}%
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>
          ▼
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '0 10px 10px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: path.domainColor, background: `${path.domainColor}18`, padding: '1px 6px', borderRadius: 4 }}>
              {path.domain}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-muted)', padding: '1px 6px', borderRadius: 4 }}>
              {path.type}
            </span>
          </div>
          {path.text && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.02)', borderRadius: 5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
              {path.text.replace(/\n+/g, ' ').trim()}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--accent)', lineHeight: 1.5, marginBottom: 8, padding: '5px 8px', background: 'var(--accent-light)', borderRadius: 5 }}>
            {path.explanation}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={e => { e.stopPropagation(); onSelect(); }}
              style={{ flex: 1, padding: '5px 8px', background: 'var(--accent)', border: 'none', borderRadius: 5, color: '#fff', fontSize: 11, fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>
              前往
            </button>
            <button onClick={e => { e.stopPropagation(); onSaveTrail(); }}
              disabled={path.isSaved}
              style={{ flex: 1, padding: '5px 8px', background: path.isSaved ? 'var(--bg-muted)' : 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, color: path.isSaved ? 'var(--text-muted)' : 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-ui)', cursor: path.isSaved ? 'default' : 'pointer' }}>
              {path.isSaved ? '已保存' : '保存路线'}
            </button>
          </div>
        </div>
      )}
    </div>
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
