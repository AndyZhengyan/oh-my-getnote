// web/components/graph/ForceGraph.tsx
'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { useGraphStore, GraphIndex } from '@/stores/graphStore';
import { registerGraphReset, registerGraphHeat, unregisterGraphReset, unregisterGraphHeat } from '@/stores/graphStore';
import { DOMAIN_COLORS } from '@/lib/constants';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
      加载图谱…
    </div>
  ),
});

type NodeLevel = 'focused' | 'level1' | 'level2' | 'peripheral' | 'ghost' | 'trajectory';

interface GraphNode {
  id: string;
  title: string;
  domain: string;
  type: string;
  connections: number;
  snippet?: string;
  x?: number;
  y?: number;
}

interface TooltipState {
  nodeId: string;
  x: number;
  y: number;
  title: string;
  domain: string;
  snippet: string;
}

/**
 * Pre-compute all node levels into a Map for O(1) hot-path lookup.
 * Called once per state change, reused across nodeCanvas, linkColor, linkWidth.
 */
export function buildLevelMap(
  selectedNodeId: string | null,
  focusedNodeId: string | null,
  focusedNeighborIds: string[] | Set<string>,
  browsePath: string[],
  graphIndex: GraphIndex | null,
): ReadonlyMap<string, NodeLevel> {
  if (!graphIndex) return new Map();

  // Build full level assignment by BFS from the seed node
  const result = new Map<string, NodeLevel>();

  // 1. Mark trajectory nodes — core identity
  for (const id of browsePath) result.set(id, 'trajectory');

  const seedId = selectedNodeId ?? focusedNodeId;
  if (!seedId) {
    // Nothing selected — remaining peripheral (except trajectory)
    for (const id of Object.keys(graphIndex.index)) {
      if (!result.has(id)) result.set(id, 'peripheral');
    }
    return result;
  }

  // BFS up to depth 2
  const visited = new Set<string>();
  const queue: [id: string, depth: number][] = [[seedId, 0]];
  visited.add(seedId);

  while (queue.length > 0) {
    const [id, depth] = queue.shift()!;
    const level = depth === 0
      ? 'focused'
      : depth === 1
        ? 'level1'
        : depth === 2
          ? 'level2'
          : undefined;
    if (level !== undefined) result.set(id, level);
    else continue; // depth > 2 → ghost (never enqueued)

    if (depth >= 2) continue; // don't expand beyond 2-hop
    const conns = graphIndex.index[id]?.connections ?? [];
    for (const conn of conns) {
      if (!visited.has(conn.noteId)) {
        visited.add(conn.noteId);
        queue.push([conn.noteId, depth + 1]);
      }
    }
  }

  // Everything not visited → ghost
  for (const id of Object.keys(graphIndex.index)) {
    if (!result.has(id)) result.set(id, 'ghost');
  }

  return result;
}

function getNodeVisual(level: NodeLevel) {
  switch (level) {
    case 'focused':    return { alpha: 1.0, rBase: 8, rScale: 1.1, ghost: false };
    case 'trajectory': return { alpha: 1.0, rBase: 7, rScale: 1.0, ghost: false };
    case 'level1':     return { alpha: 0.8, rBase: 5, rScale: 1.0, ghost: false };
    case 'level2':     return { alpha: 0.2, rBase: 4, rScale: 0.8, ghost: false };
    case 'ghost':      return { alpha: 0.04, rBase: 2, rScale: 0.5, ghost: true };
    default:           return { alpha: 0.5, rBase: 3, rScale: 1.0, ghost: false };
  }
}

export default function ForceGraph() {
  const {
    graphIndex, domainFilter, typeFilter, searchQuery,
    selectedNodeId, selectNode,
    focusedNodeId, focusedNeighborIds, focusMode,
    setCurrentScale, focusNode, setFocusMode,
    highlightedTrailNodeIds,
    browsePath,
    clearBrowsePath,
    clearRecommendedPaths,
  } = useGraphStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<NodeObject, LinkObject>>(undefined);
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [zoomState, setZoomState] = useState<{ x: number; y: number; k: number }>({ x: dims.w / 2, y: dims.h / 2, k: 1 });
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const levelMap = useMemo(
    () => buildLevelMap(selectedNodeId, focusedNodeId, focusedNeighborIds, browsePath, graphIndex),
    [selectedNodeId, focusedNodeId, focusedNeighborIds, browsePath, graphIndex]
  );

  const { nodes, links } = useMemo(
    () => buildGraphData(graphIndex, domainFilter, typeFilter, searchQuery, levelMap, selectedNodeId, focusedNodeId),
    [graphIndex, domainFilter, typeFilter, searchQuery, levelMap, selectedNodeId, focusedNodeId]
  );

  // Register reset and heat functions with the global event system
  useEffect(() => {
    registerGraphReset(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(800, 100);
        fgRef.current.d3ReheatSimulation();
        fgRef.current.resumeAnimation();
      }
    });
    registerGraphHeat(() => {
      if (fgRef.current) {
        fgRef.current.d3ReheatSimulation();
        fgRef.current.resumeAnimation();
      }
    });
    return () => {
      unregisterGraphReset();
      unregisterGraphHeat();
    };
  }, []);

  // Auto-fit after data changes (e.g. filter / click)
  useEffect(() => {
    if (fgRef.current && nodes.length > 0) {
      // Reheat + resume after layout changes (filter, etc.)
      setTimeout(() => {
        if (!fgRef.current) return;
        if (nodes.length <= 4) {
          // Few nodes: we've set fx/fy to 0 in buildGraphData.
          // Center the view at node origin (0,0) and use custom zoom.
          fgRef.current.centerAt(0, 0, 400);
          fgRef.current.zoom(nodes.length === 1 ? 1.5 : 1.0, 400);
          // Re-clear cache so they don't jump back to old positions on next filter
          if ((globalThis as any)._nodePosCache) {
            nodes.forEach(n => (globalThis as any)._nodePosCache.delete(n.id));
          }
        } else {
          // Multi-node: use standard zoomToFit.
          fgRef.current.centerAt(0, 0, 1);
          fgRef.current.zoomToFit(800, 100);
          fgRef.current.d3ReheatSimulation();
          fgRef.current.resumeAnimation();
        }
      }, 100);
    }
  }, [nodes]); // Trigger whenever node set changes (including filtering)

  // Let simulation settle on initial load. After ~3s alpha decays enough that
  // the RAF naturally exits (doRedraw = false when engine stops). We do NOT call
  // pauseAnimation() here — it cancels pending RAF callbacks including click
  // handlers, which would make all nodes unclickable.
  useEffect(() => {
    if (!fgRef.current || nodes.length === 0) return;
    // No cleanup needed — alpha(0) is set by filter effect or this settles naturally
  }, [nodes.length]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const trailNodeSet = useMemo(() => new Set(highlightedTrailNodeIds), [highlightedTrailNodeIds]);
  const trailLinkSet = useMemo(() => new Set(
    browsePath.slice(0, -1).map((id, i) => `${id}→${browsePath[i + 1]}`)
  ), [browsePath]);

  // Throttle tooltip updates to avoid excessive React re-renders during mouse movement.
  const lastMouseMoveRef = useRef(0);
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Throttle to ~60fps to reduce React re-renders without losing responsiveness
    const now = performance.now();
    if (now - lastMouseMoveRef.current < 16) return;
    lastMouseMoveRef.current = now;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !graphIndex) return;

    // Convert mouse position to canvas-world coordinates (account for zoom + pan)
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const mx = (screenX - zoomState.x) / zoomState.k;
    const my = (screenY - zoomState.y) / zoomState.k;

    let closest: TooltipState | null = null;
    let closestDist = 25;

    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      const level = levelMap.get(node.id) ?? 'peripheral';
      const visual = getNodeVisual(level);
      // Don't show tooltip for ghost nodes
      if (visual.ghost) continue;

      const dx = mx - node.x;
      const dy = my - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = (visual.rBase + Math.min(node.connections / 2, 10)) * visual.rScale + 6;
      if (dist < hitRadius && dist < closestDist) {
        closestDist = dist;
        closest = {
          nodeId: node.id,
          x: screenX,
          y: screenY,
          title: node.title,
          domain: node.domain,
          snippet: node.connections > 0 ? `${node.connections} 条关联` : '暂无关联',
        };
      }
    }
    setTooltip(closest);
  }, [nodes, graphIndex, levelMap, zoomState]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    fgRef.current?.resumeAnimation();
  }, []);

  const MAX_ZOOM = 2.5;

  const handleZoom = useCallback((transform: { k: number; x: number; y: number }) => {
    // NOTE: Defer state updates via rAF to avoid "Cannot update a component
    // while rendering" error. ForceGraph2D can fire onZoom during its render
    // phase; calling setState directly would trigger React's concurrent-mode
    // safeguard.
    requestAnimationFrame(() => {
      setZoomState({ x: transform.x, y: transform.y, k: transform.k });
      setCurrentScale(Math.min(transform.k, MAX_ZOOM));
    });
    // NOTE: Do NOT call resumeAnimation() here — it triggers an internal
    // zoom event that re-enters handleZoom → infinite recursion (stack overflow).
    // Animation is resumed on user interactions (click/drag) via handleNodeClick, etc.
  }, []);
  useEffect(() => {
    if (fgRef.current && nodes.length > 0) {
      const checkZoom = () => {
        if (!fgRef.current) return;
        const currentScaleVal = fgRef.current.zoom();
        if (currentScaleVal > MAX_ZOOM) {
          fgRef.current.zoom(MAX_ZOOM, 800);
        }
      };
      setTimeout(checkZoom, 1200);
    }
  }, [nodes]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    // Prevent selecting ghost (peripheral dimmed) nodes
    const level = levelMap.get(node.id) ?? 'peripheral';
    if (level === 'ghost') return;
    fgRef.current?.resumeAnimation();
    selectNode(node.id);
  }, [selectNode, levelMap]);

  const handleNodeRightClick = useCallback((node: GraphNode) => {
    fgRef.current?.resumeAnimation();
    focusNode(node.id);
  }, [focusNode]);

  const handleBackgroundClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'CANVAS') {
      if (browsePath.length > 0) {
        setClearConfirmOpen(true);
      } else {
        selectNode(null);
        setFocusMode(false);
      }
    }
  }, [browsePath.length, selectNode, setFocusMode]);

  const handleBackgroundRightClick = useCallback(() => {
    setFocusMode(false);
  }, [setFocusMode]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={{ nodes, links }}
        width={dims.w}
        height={dims.h}
        onZoom={handleZoom as (transform: { k: number }) => void}
        nodeCanvasObject={(node: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const n = node as GraphNode & { x?: number; y?: number; vx?: number; vy?: number };
          if (n.x == null || n.y == null) return;

          // Update cache for re-renders/filters
          if (!(globalThis as any)._nodePosCache) (globalThis as any)._nodePosCache = new Map();
          (globalThis as any)._nodePosCache.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });

          const level = levelMap.get(n.id) ?? 'peripheral';
          const visual = getNodeVisual(level);
          const maxConn = 10;
          const r = (visual.rBase + Math.min(n.connections / 2, maxConn)) * visual.rScale;
          const domainColor = DOMAIN_COLORS[n.domain] ?? '#9CA3AF';

          ctx.globalAlpha = visual.alpha;

          // 1. Determine "Role" for coloring
          const pathIdx = browsePath.indexOf(n.id);
          const isTrajectory = pathIdx !== -1;
          const isCurrent = n.id === selectedNodeId || level === 'focused';
          const isRecommendation = (level === 'level1' || level === 'level2') && !isTrajectory;

          // Breathing glow for current location
          if (isCurrent) {
            const pulse = (Math.sin(Date.now() / 400) + 1) / 2;
            ctx.shadowColor = isTrajectory ? '#7C3AED' : '#F59E0B';
            ctx.shadowBlur = 10 + pulse * 15;
          }

          // 2. Render Node Body
          let fillStyle = domainColor;
          if (isTrajectory) {
            // Purple gradient based on recency
            // Last node (isCurrent) is deep purple, older nodes fade
            const age = browsePath.length - 1 - pathIdx;
            const opacity = Math.max(0.3, 1 - age * 0.15);
            fillStyle = `rgba(124, 58, 237, ${opacity})`;
          } else if (isRecommendation) {
            // Recommendations are Amber
            fillStyle = '#F59E0B';
          }

          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fillStyle = fillStyle;
          ctx.fill();

          // 3. Render Selection/Tracing Overlays
          if (isCurrent) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Trail highlight (amber dashed circle for ANY node in browsePath to show it's part of history)
          if (isTrajectory && !isCurrent) {
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Reset shadow
          ctx.shadowBlur = 0;

          // Semantic zoom: content varies by zoom level
          // - globalScale < 0.5: far view → no label, just the dot
          // - globalScale 0.5–1.2: mid view → node title
          // - globalScale > 1.2: close view → title + first 2 lines of body
          if (!visual.ghost && globalScale >= 0.5) {
            const labelColor = level === 'focused' ? '#7C3AED' : '#9CA3AF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            const baseFontSize = 9;
            const fontSize = Math.max(7, Math.min(baseFontSize / globalScale, 11));
            ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = labelColor;

            // Dim labels when zoomed out, clearer when zoomed in
            ctx.globalAlpha = visual.alpha * (globalScale > 1 ? 0.85 : 0.4 + globalScale * 0.5);

            const label = n.title.length > 22 ? n.title.slice(0, 21) + '…' : n.title;
            const labelY = n.y + r + 4;
            ctx.fillText(label, n.x, labelY);

            // Close view: show first 2 lines of body snippet
            if (globalScale > 1.2 && n.snippet) {
              const snippetFontSize = Math.max(6, Math.min(8 / globalScale, 10));
              ctx.font = `400 ${snippetFontSize}px Inter, system-ui, sans-serif`;
              ctx.fillStyle = '#6B7280';
              ctx.globalAlpha = visual.alpha * 0.6;

              const rawLines = n.snippet.split('\n').filter(l => l.trim());
              const lines = rawLines.slice(0, 2).map(l =>
                l.length > 40 ? l.slice(0, 39) + '…' : l
              );
              lines.forEach((line, i) => {
                ctx.fillText(line, n.x!, labelY + snippetFontSize * 1.4 * (i + 1));
              });
            }
          }
          ctx.globalAlpha = 1;
        }}
        linkColor={(link: unknown) => {
          const l = link as { source: { id: string } | string; target: { id: string } | string };
          const sid = typeof l.source === 'object' ? (l.source as { id: string }).id : String(l.source);
          const tid = typeof l.target === 'object' ? (l.target as { id: string }).id : String(l.target);

          const sLevel = levelMap.get(sid) ?? 'peripheral';
          const tLevel = levelMap.get(tid) ?? 'peripheral';
          if (sLevel === 'ghost' || tLevel === 'ghost') return 'rgba(0,0,0,0)';

          // 1. Trail edges (My logic steps) -> Amber solid
          if (trailLinkSet.has(`${sid}→${tid}`) || trailLinkSet.has(`${tid}→${sid}`)) return '#F59E0B';

          // 2. Recommendation edges (Future steps from current node) -> Faint Amber
          if (selectedNodeId || focusMode) {
            const isFromCurrent = sid === selectedNodeId || tid === selectedNodeId || sid === focusedNodeId || tid === focusedNodeId;
            if (isFromCurrent && (sLevel === 'level1' || tLevel === 'level1')) {
              return 'rgba(245, 158, 11, 0.4)'; // Faint amber for "Future paths"
            }
            if (sLevel === 'level1' || tLevel === 'level1') {
              return 'rgba(124, 58, 237, 0.1)'; // Very faint purple for background relations
            }
            return 'rgba(0,0,0,0.01)';
          }
          return 'rgba(0,0,0,0.04)';
        }}
        linkWidth={(link: unknown) => {
          const l = link as { source: { id: string } | string; target: { id: string } | string };
          const sid = typeof l.source === 'object' ? (l.source as { id: string }).id : String(l.source);
          const tid = typeof l.target === 'object' ? (l.target as { id: string }).id : String(l.target);

          const isTrajectory = trailLinkSet.has(`${sid}→${tid}`) || trailLinkSet.has(`${tid}→${sid}`);
          if (isTrajectory) return 2.5;

          const isFromCurrent = sid === selectedNodeId || tid === selectedNodeId || sid === focusedNodeId || tid === focusedNodeId;
          if (isFromCurrent) return 1.2;

          return 0.5;
        }}
        onNodeClick={handleNodeClick as (node: unknown) => void}
        onNodeRightClick={handleNodeRightClick as (node: unknown) => void}
        onNodeDrag={() => fgRef.current?.resumeAnimation()}
        onNodeDragEnd={() => {
          if (dragEndTimerRef.current) clearTimeout(dragEndTimerRef.current);
          dragEndTimerRef.current = setTimeout(() => {
            // Do NOT call pauseAnimation() — it cancels click RAFs.
            // Just set alpha manually to 0 if we want to freeze physics.
            if (fgRef.current) {
              try {
                // @ts-ignore
                fgRef.current.d3Force('')?.alpha(0);
              } catch { /* ignore */ }
            }
          }, 2000);
        }}
        onBackgroundClick={handleBackgroundClick as (e: MouseEvent) => void}
        onBackgroundRightClick={handleBackgroundRightClick}
        cooldownTicks={60}
        backgroundColor="#F8F9FB"
      />

      {/* Clear trail confirmation dialog */}
      {clearConfirmOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setClearConfirmOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.25)',
              zIndex: 400,
            }}
          />
          {/* Dialog */}
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
                onClick={() => setClearConfirmOpen(false)}
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
                onClick={() => {
                  clearBrowsePath();
                  clearRecommendedPaths();
                  setClearConfirmOpen(false);
                }}
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
      )}

      {/* Hover tooltip */}
      {tooltip && (
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
          <div style={{ fontSize: 11, color: DOMAIN_COLORS[tooltip.domain] ?? 'var(--accent)', marginBottom: 4 }}>
            {tooltip.domain}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {tooltip.snippet}
          </div>
        </div>
      )}
    </div>
  );
}

function buildGraphData(
  index: GraphIndex | null,
  domainFilter: string,
  typeFilter: string,
  searchQuery: string,
  levelMap: ReadonlyMap<string, NodeLevel>,
  selectedNodeId: string | null,
  focusedNodeId: string | null,
): { nodes: GraphNode[]; links: Array<{ source: string; target: string; score?: number }> } {
  if (!index) return { nodes: [], links: [] };

  const q = searchQuery.toLowerCase();
  const nodes: GraphNode[] = [];
  const links: Array<{ source: string; target: string; score?: number }> = [];
  const seenNodes = new Set<string>();

  // Active set: nodes that pass filters
  const activeIds = new Set<string>();
  for (const [id, entry] of Object.entries(index.index)) {
    if (domainFilter && entry.domain !== domainFilter) continue;
    if (typeFilter && entry.type !== typeFilter) continue;
    if (q && !entry.title.toLowerCase().includes(q) && !entry.bodyPreview?.toLowerCase().includes(q)) continue;
    // Keep ghost nodes in the simulation if they pass global filters,
    // so their physical state persists even when dimmed.
    activeIds.add(id);
  }

  // Second pass: build nodes and links
  const showAllConnections = selectedNodeId !== null || focusedNodeId !== null;
  const MAX_CONNS_PER_NODE = showAllConnections ? Infinity : 3;

  const isFewNodes = activeIds.size <= 4;

  for (const id of activeIds) {
    const entry = index.index[id]!;
    if (!seenNodes.has(id)) {
      seenNodes.add(id);
      // @ts-ignore - Check if we have this node in global position cache
      const cached = (globalThis as any)._nodePosCache?.get(id);

      const node: any = {
        id, title: entry.title, domain: entry.domain, type: entry.type,
        connections: entry.connections.length, snippet: entry.bodyPreview ?? '',
        ...cached
      };

      // If very few nodes, force them toward origin so they don't spawn
      // at (0,0) and then drift away due to big zoom scaling.
      if (isFewNodes) {
        node.fx = 0;
        node.fy = 0;
        // Spread them out slightly if multiple
        if (activeIds.size > 1) {
          const idx = nodes.length;
          const angle = (idx / activeIds.size) * Math.PI * 2;
          node.fx = Math.cos(angle) * 20;
          node.fy = Math.sin(angle) * 20;
        }
      }

      nodes.push(node);
    }

    // Sort by score descending and take top-N when in default view
    const conns = showAllConnections
      ? entry.connections
      : [...entry.connections].sort((a, b) => b.score - a.score).slice(0, MAX_CONNS_PER_NODE);

    for (const conn of conns) {
      if (activeIds.has(conn.noteId)) {
        links.push({ source: id, target: conn.noteId, score: conn.score });
      }
    }
  }

  return { nodes, links };
}
