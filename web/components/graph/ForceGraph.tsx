// web/components/graph/ForceGraph.tsx
'use client';

import { useCallback, useMemo, useState, useEffect, useRef, Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { useGraphStore } from '@/stores/graphStore';
import { registerGraphReset, registerGraphHeat, unregisterGraphReset, unregisterGraphHeat } from '@/stores/graphStore';
import type { GraphNode, TooltipState } from './types';
import { buildLevelMap, getNodeVisual, useGraphData } from './useGraphData';
import Tooltip from './Tooltip';
import ClearConfirmDialog from './ClearConfirmDialog';

// Safe global cache type for node position tracking
interface NodePosCache {
  _nodePosCache?: Map<string, { x: number; y: number }>;
}

const getNodePosCache = (): Map<string, { x: number; y: number }> => {
  const cache = (globalThis as unknown as NodePosCache);
  if (!cache._nodePosCache) {
    cache._nodePosCache = new Map();
  }
  return cache._nodePosCache;
};

// Helper to get link source/target ID safely
function getLinkEndpoint(link: unknown): { sid: string; tid: string } {
  const l = link as { source: { id: string } | string; target: { id: string } | string };
  const sid = typeof l.source === 'object' ? (l.source as { id: string }).id : String(l.source);
  const tid = typeof l.target === 'object' ? (l.target as { id: string }).id : String(l.target);
  return { sid, tid };
}

/** Catches canvas/event errors from react-force-graph-2d (e.g. after Turbopack HMR). */
class ForceGraphErrorBoundary extends Component<{ children: ReactNode; fgRef: React.MutableRefObject<ForceGraphMethods<NodeObject, LinkObject> | undefined> }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fgRef: React.MutableRefObject<ForceGraphMethods<NodeObject, LinkObject> | undefined> }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn('[ForceGraph] Caught error, re-mounting:', error.message);
    // Force fgRef to be cleared so next mount starts fresh
    this.props.fgRef.current = undefined;
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
          图谱加载异常，刷新页面后重试
        </div>
      );
    }
    return this.props.children;
  }
}

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--text-muted)',
            animation: 'graphPulse 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
      <span style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-ui)' }}>渲染中…</span>
      <style>{`@keyframes graphPulse { 0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:.7;transform:scale(1)} }`}</style>
    </div>
  ),
});

export default function ForceGraph() {
  const {
    graphIndex, typeFilter, tagTreeFilter, searchQuery,
    selectedNodeId, selectNode,
    focusedNodeId, focusedNeighborIds, focusMode,
    setCurrentScale, focusNode, setFocusMode,
    highlightedTrailNodeIds,
    browsePath,
    clearSelection,
  } = useGraphStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<NodeObject, LinkObject>>(undefined);
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fix #102: re-center after the right panel animation completes (0.28s).
  // Stores the nodeId to re-center so the ResizeObserver handler can cancel the
  // pending timer on subsequent triggers and stale unmounts.
  const pendingCenterRef = useRef<{ nodeId: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  // Tracks whether a new node was just selected so the auto-fit effect (nodes[])
  // skips its animated zoom and leaves centering/zooming to the [selectedNodeId] effect.
  const skipAutoFitZoomRef = useRef(false);
  const autoFitSkipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track previous node count to detect removals vs additions
  const prevNodeCountRef = useRef(0);
  // Pulse time ref: updated via rAF, avoids Date.now() in canvas callback
  const pulseTimeRef = useRef(0);
  const pulseRafRef = useRef<number | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [zoomState, setZoomState] = useState<{ x: number; y: number; k: number }>({ x: dims.w / 2, y: dims.h / 2, k: 1 });
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  // Pinned tooltips: automatically show top-N related nodes as persistent cards
  const [pinnedTooltips, setPinnedTooltips] = useState<TooltipState[]>([]);
  const pinnedTooltipsRef = useRef<TooltipState[]>([]);
  const pinnedPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const levelMap = useMemo(
    () => buildLevelMap(selectedNodeId, focusedNodeId, focusedNeighborIds, browsePath, graphIndex),
    [selectedNodeId, focusedNodeId, focusedNeighborIds, browsePath, graphIndex]
  );

  const { nodes, links } = useGraphData(
    graphIndex,
    typeFilter,
    tagTreeFilter,
    searchQuery,
    levelMap,
    selectedNodeId,
    focusedNodeId,
    browsePath
  );

  // Stable reference for ForceGraph2D — avoids canvas re-render on every
  // tooltip state update which creates new { nodes, links } inline objects.
  const graphData = useMemo(() => ({ nodes, links }), [nodes, links]);

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
      // Detect if this was a node removal (as opposed to filter/search adding nodes)
      const isRemoval = nodes.length < prevNodeCountRef.current;
      prevNodeCountRef.current = nodes.length;

      // Reheat + resume after layout changes (filter, etc.)
      setTimeout(() => {
        if (!fgRef.current) return;
        const skipZoom = skipAutoFitZoomRef.current;
        // Account for right panel width when centering the graph
        // This shifts the "center" of the graph slightly to the left so it
        // remains visually centered when the right panel is open.
        // Note: we read rightPanelOpen from the store directly inside the effect
        // to avoid re-triggering this effect when the panel opens/closes.
        const panelOffset = useGraphStore.getState().rightPanelOpen ? 250 : 0;

        if (nodes.length <= 4) {
          // Few nodes: we've set fx/fy to 0 in buildGraphData.
          // Only center at origin if this wasn't a removal (to avoid jumping).
          if (!isRemoval) {
            fgRef.current.centerAt(0, 0, 400);
          }
          if (!skipZoom) {
            fgRef.current.zoom(nodes.length === 1 ? 1.5 : 1.0, 400);
          }
          // Re-clear cache so they don't jump back to old positions on next filter
          const nodePosCache = getNodePosCache();
          nodes.forEach(n => nodePosCache.delete(n.id));
        } else {
          // Multi-node: only recenter if this wasn't a removal.
          // On removal, let the force simulation rebalance naturally without jumping.
          if (!isRemoval) {
            fgRef.current.centerAt(0, 0, 1);
          }
          if (!skipZoom) {
            if (!isRemoval) {
              // Adjust padding to account for the right panel pushing the graph left
              fgRef.current.zoomToFit(400, 50 + panelOffset);
            }
            fgRef.current.d3ReheatSimulation();
            fgRef.current.resumeAnimation();
          }
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

  const pendingCenterRafRef = useRef(0);

  // Pan to the selected node when it changes (e.g. from clicking a recommended path card).
  // Retries with rAF because nodeCanvasObject (which populates getNodePosCache) runs inside
  // the ForceGraph2D rAF loop, which fires after React effects — so the cache is empty on the
  // first attempt for newly added nodes.
  useEffect(() => {
    if (!selectedNodeId || !fgRef.current) return;
    let attempts = 0;
    const maxAttempts = 15;

    const tryCenter = () => {
      if (!fgRef.current) return;
      const nodePos = getNodePosCache().get(selectedNodeId);
      if (nodePos && nodePos.x != null && nodePos.y != null) {
        fgRef.current.centerAt(nodePos.x, nodePos.y, 400);
        return;
      }
      if (++attempts < maxAttempts) {
        pendingCenterRafRef.current = requestAnimationFrame(tryCenter);
      }
    };
    cancelAnimationFrame(pendingCenterRafRef.current);
    pendingCenterRafRef.current = requestAnimationFrame(tryCenter);
    return () => cancelAnimationFrame(pendingCenterRafRef.current);
  }, [selectedNodeId]);

  // When a node is selected, zoom in to show its neighborhood (≈20-25 nodes, readable titles).
  // Also sets skipAutoFitZoomRef so the [nodes] auto-fit effect defers to this centering.
  // Same rAF retry as above — position cache may be empty for newly added nodes.
  useEffect(() => {
    if (!selectedNodeId || !fgRef.current) return;
    // Signal the [nodes] auto-fit effect to skip its animated zoom, then clear
    // the flag after the auto-fit timeout fires so subsequent filter changes still auto-fit.
    skipAutoFitZoomRef.current = true;
    if (autoFitSkipTimerRef.current) clearTimeout(autoFitSkipTimerRef.current);
    autoFitSkipTimerRef.current = setTimeout(() => { skipAutoFitZoomRef.current = false; }, 200);

    let attempts = 0;
    const maxAttempts = 15;

    const tryZoom = () => {
      if (!fgRef.current) return;
      const nodePos = getNodePosCache().get(selectedNodeId);
      if (nodePos && nodePos.x != null && nodePos.y != null) {
        fgRef.current.centerAt(nodePos.x, nodePos.y, 300);
        fgRef.current.zoom(2.5, 300);
        return;
      }
      if (++attempts < maxAttempts) {
        requestAnimationFrame(tryZoom);
      }
    };
    requestAnimationFrame(tryZoom);
  }, [selectedNodeId]);

  // Initial graph zoom-in: show ~20-30 nodes with readable titles (not all 655)
  const initialZoomDone = useRef(false);
  useEffect(() => {
    if (!fgRef.current || nodes.length === 0 || initialZoomDone.current) return;
    initialZoomDone.current = true;
    setTimeout(() => {
      if (!fgRef.current) return;
      fgRef.current.centerAt(0, 0, 1);
      fgRef.current.zoom(1.2, 500);
    }, 1500);
  }, [nodes.length]);

  // Re-fit the graph when the container resizes (e.g. right panel closes/opens)
  useEffect(() => {
    if (!containerRef.current) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
      // Debounce zoomToFit so the DOM has settled before re-fitting
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (fgRef.current && nodes.length > 0) {
          fgRef.current.zoomToFit(400, 50);
        }
      }, 150);
    });
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [nodes.length]);

  // Fix #102: when the right panel opens it shrinks the canvas container,
  // breaking the centering done by the [selectedNodeId] effect.
  // Detect the shrink (panel opening) and re-center after the panel animation finishes.
  useEffect(() => {
    if (!containerRef.current || !selectedNodeId) return;
    let lastWidth = containerRef.current.getBoundingClientRect().width;

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        // Only act when the container shrinks (panel is opening), not when it grows (panel closing).
        if (newWidth < lastWidth) {
          // Cancel any previously pending re-center.
          if (pendingCenterRef.current) {
            clearTimeout(pendingCenterRef.current.timer);
          }
          // Re-center after the panel's 0.28s animation completes.
          const timer = setTimeout(() => {
            if (!fgRef.current || !selectedNodeId) return;
            const nodePos = getNodePosCache().get(selectedNodeId);
            if (nodePos && nodePos.x != null) {
              fgRef.current.centerAt(nodePos.x, nodePos.y, 300);
              fgRef.current.zoom(2.5, 300);
            }
            pendingCenterRef.current = null;
          }, 350);
          pendingCenterRef.current = { nodeId: selectedNodeId, timer };
        }
        lastWidth = newWidth;
      }
    });
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      if (pendingCenterRef.current) {
        clearTimeout(pendingCenterRef.current.timer);
        pendingCenterRef.current = null;
      }
    };
  }, [selectedNodeId]);

  // Cleanup timers on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (autoFitSkipTimerRef.current) clearTimeout(autoFitSkipTimerRef.current);
      if (dragEndTimerRef.current) clearTimeout(dragEndTimerRef.current);
      if (pulseRafRef.current) cancelAnimationFrame(pulseRafRef.current);
      if (pendingCenterRef.current) { clearTimeout(pendingCenterRef.current.timer); pendingCenterRef.current = null; }
    };
  }, []);

  // When a node is selected, show top-3 related nodes as pinned tooltip cards on canvas.
  useEffect(() => {
    if (!selectedNodeId || !graphIndex || !fgRef.current) {
      setPinnedTooltips([]);
      return;
    }
    const entry = graphIndex.index[selectedNodeId];
    if (!entry || !entry.connections.length) {
      setPinnedTooltips([]);
      return;
    }
    // Top 3 by connection score, exclude already-visited browsePath nodes
    const visited = new Set(browsePath);
    const top3 = entry.connections
      .filter(c => !visited.has(c.noteId))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const tips: TooltipState[] = top3.map(c => {
      const ce = graphIndex.index[c.noteId];
      // Use cached position for immediate placement; rAF loop keeps it updated
      const nodePos = getNodePosCache().get(c.noteId);
      let sx = 0, sy = 0;
      if (nodePos && nodePos.x != null && nodePos.y != null && fgRef.current) {
        const screen = fgRef.current.graph2ScreenCoords(nodePos.x, nodePos.y);
        sx = screen.x; sy = screen.y;
      }
      return {
        nodeId: c.noteId,
        x: sx, y: sy,
        title: ce?.title ?? c.noteId,
        type: ce?.type ?? '',
        createdAt: ce?.createdAt ?? '',
        snippet: ce?.bodyPreview ?? '',
      };
    });
    setPinnedTooltips(tips);
    pinnedTooltipsRef.current = tips;
  }, [selectedNodeId, browsePath, graphIndex]);

  // rAF loop for canvas pulse animation + pinned tooltip position updates.
  // Each card is placed near its own node, with vertical collision resolution.
  useEffect(() => {
    const CARD_H = 112;
    const CARD_GAP = 6;
    let rafId: number;
    const tick = () => {
      pulseTimeRef.current = performance.now();
      const fg = fgRef.current;
      const current = pinnedTooltipsRef.current;
      if (fg && current.length > 0) {
        // Collect per-node screen positions with metadata
        const items = current.map(pt => {
          const pos = getNodePosCache().get(pt.nodeId);
          const screen = (pos && pos.x != null && pos.y != null)
            ? fg.graph2ScreenCoords(pos.x, pos.y) : null;
          return { pt, screen };
        }).filter(it => it.screen) as { pt: TooltipState; screen: { x: number; y: number } }[];

        if (items.length > 0) {
          // Preferred position: to the right of each node, vertically centered on it
          const preferred = items.map(it => ({
            ...it,
            px: it.screen.x + 16,
            py: it.screen.y - CARD_H / 2,
          }));

          // Sort by preferred Y for overlap resolution
          preferred.sort((a, b) => a.py - b.py);

          // Resolve vertical overlaps: push down overlapped cards
          for (let i = 1; i < preferred.length; i++) {
            const prevBottom = preferred[i - 1].py + CARD_H + CARD_GAP;
            if (preferred[i].py < prevBottom) {
              preferred[i].py = prevBottom;
            }
          }

          // Detect changes and update
          let changed = false;
          const next = new Map<string, { x: number; y: number }>();
          for (const p of preferred) {
            next.set(p.pt.nodeId, { x: p.px, y: p.py });
            const prev = pinnedPosRef.current.get(p.pt.nodeId);
            if (!prev || Math.abs(prev.x - p.px) > 0.5 || Math.abs(prev.y - p.py) > 0.5) {
              changed = true;
            }
          }
          if (changed) {
            pinnedPosRef.current = next;
            setPinnedTooltips(prev => prev.map(pt => {
              const s = next.get(pt.nodeId);
              return s ? { ...pt, x: s.x, y: s.y } : pt;
            }));
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    pulseRafRef.current = rafId;
    return () => cancelAnimationFrame(rafId);
  }, []);

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
    const fg = fgRef.current;
    if (!rect || !graphIndex || !fg) return;

    // Use the graph's built-in coordinate conversion — always correct
    // regardless of programmatic zoom/pan that bypasses handleZoom.
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = fg.screen2GraphCoords(screenX, screenY);
    const mx = worldPos.x;
    const my = worldPos.y;

    let closest: TooltipState | null = null;
    let closestDist = 25;

    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      const level = levelMap.get(node.id) ?? 'peripheral';
      const visual = getNodeVisual(level);
      // Don't show tooltip for ghost nodes or nodes with pinned cards
      if (visual.ghost) continue;
      if (pinnedTooltips.some(pt => pt.nodeId === node.id)) continue;

      const dx = mx - node.x;
      const dy = my - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = (visual.rBase + Math.min(node.connections / 2, 10)) * visual.rScale + 6;
      if (dist < hitRadius && dist < closestDist) {
        closestDist = dist;
        // Position tooltip at the node's canvas coords converted to screen space
        // via the graph's own conversion, so the card follows the node position.
        const nodeScreen = fg.graph2ScreenCoords(node.x, node.y);
        const entry = graphIndex.index[node.id];
        closest = {
          nodeId: node.id,
          x: nodeScreen.x,
          y: nodeScreen.y,
          title: node.title,
          type: entry?.type ?? '',
          createdAt: entry?.createdAt ?? '',
          snippet: entry?.bodyPreview ?? '',
        };
      }
    }
    setTooltip(closest);
  }, [nodes, graphIndex, levelMap, pinnedTooltips]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    fgRef.current?.resumeAnimation();
  }, []);

  const MAX_ZOOM = 2.5;

  const handleZoom = useCallback((transform: { k: number; x: number; y: number }) => {
    // Defer React state via rAF to avoid "Cannot update a component while
    // rendering" — ForceGraph2D fires onZoom during its render phase.
    requestAnimationFrame(() => {
      setZoomState({ x: transform.x, y: transform.y, k: transform.k });
      setCurrentScale(Math.min(transform.k, MAX_ZOOM));
    });
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
      setPinnedTooltips([]);
      pinnedTooltipsRef.current = [];
      if (browsePath.length > 0) {
        setClearConfirmOpen(true);
      } else {
        clearSelection();
        setFocusMode(false);
      }
    }
  }, [browsePath.length, clearSelection, setFocusMode]);

  const handleBackgroundRightClick = useCallback(() => {
    setFocusMode(false);
  }, [setFocusMode]);

  // Extract nodeCanvasObject to prevent recreation on every render
  const nodeCanvasObject = useCallback((node: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as GraphNode & { x?: number; y?: number; vx?: number; vy?: number };
    if (n.x == null || n.y == null) return;

    // Update cache for re-renders/filters
    getNodePosCache().set(n.id, { x: n.x, y: n.y });

    const level = levelMap.get(n.id) ?? 'peripheral';
    const visual = getNodeVisual(level);
    const maxConn = 10;
    const r = (visual.rBase + Math.min(n.connections / 2, maxConn)) * visual.rScale;
    const domainColor = '#9CA3AF';

    ctx.globalAlpha = visual.alpha;

    // 1. Determine "Role" for coloring
    const pathIdx = browsePath.indexOf(n.id);
    const isTrajectory = pathIdx !== -1;
    const isCurrent = n.id === selectedNodeId || level === 'focused';
    const isRecommendation = (level === 'level1' || level === 'level2') && !isTrajectory;

    // Breathing glow for current location
    if (isCurrent) {
      const pulse = (Math.sin(pulseTimeRef.current / 400) + 1) / 2;
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
  }, [levelMap, browsePath, selectedNodeId]);

  // Extract linkColor to prevent recreation on every render
  const linkColor = useCallback((link: unknown): string => {
    const { sid, tid } = getLinkEndpoint(link);

    const sLevel = levelMap.get(sid) ?? 'peripheral';
    const tLevel = levelMap.get(tid) ?? 'peripheral';
    if (sLevel === 'ghost' || tLevel === 'ghost') return 'rgba(0,0,0,0)';

    // 1. Trail edges (My logic steps) -> Purple solid
    if (trailLinkSet.has(`${sid}→${tid}`) || trailLinkSet.has(`${tid}→${sid}`)) return '#7C3AED';

    // 2. Recommendation edges (Future steps from current node) -> Faint Purple
    if (selectedNodeId || focusMode) {
      const isFromCurrent = sid === selectedNodeId || tid === selectedNodeId || sid === focusedNodeId || tid === focusedNodeId;
      if (isFromCurrent && (sLevel === 'level1' || tLevel === 'level1')) {
        return 'rgba(124, 58, 237, 0.4)'; // Faint purple for "Future paths"
      }
      if (sLevel === 'level1' || tLevel === 'level1') {
        return 'rgba(124, 58, 237, 0.1)'; // Very faint purple for background relations
      }
      return 'rgba(0,0,0,0.01)';
    }
    return 'rgba(0,0,0,0.04)';
  }, [levelMap, trailLinkSet, selectedNodeId, focusMode, focusedNodeId]);

  // Extract linkWidth to prevent recreation on every render
  const linkWidth = useCallback((link: unknown): number => {
    const { sid, tid } = getLinkEndpoint(link);

    const isTrajectory = trailLinkSet.has(`${sid}→${tid}`) || trailLinkSet.has(`${tid}→${sid}`);
    if (isTrajectory) return 4;

    const isFromCurrent = sid === selectedNodeId || tid === selectedNodeId || sid === focusedNodeId || tid === focusedNodeId;
    if (isFromCurrent) return 1.2;

    return 0.5;
  }, [trailLinkSet, selectedNodeId, focusedNodeId]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <ForceGraphErrorBoundary fgRef={fgRef}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={dims.w}
        height={dims.h}
        onZoom={handleZoom}
        nodeCanvasObject={nodeCanvasObject}
        linkColor={linkColor}
        linkWidth={linkWidth}
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
                fgRef.current.d3Force('')?.alpha(0);
              } catch (err) {
                console.error('[ForceGraph] d3Force freeze failed:', err);
              }
            }
          }, 2000);
        }}
        onBackgroundClick={handleBackgroundClick as (e: MouseEvent) => void}
        onBackgroundRightClick={handleBackgroundRightClick}
        cooldownTicks={60}
        backgroundColor="#F8F9FB"
      />
      </ForceGraphErrorBoundary>

      <ClearConfirmDialog isOpen={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)} />
      <Tooltip tooltip={tooltip} />
      {pinnedTooltips.map((pt, i) => (
        <Tooltip key={pt.nodeId} tooltip={pt} pinned rank={i + 1}
          onClick={() => {
            setPinnedTooltips([]);
            pinnedTooltipsRef.current = [];
            selectNode(pt.nodeId);
          }}
        />
      ))}
    </div>
  );
}
