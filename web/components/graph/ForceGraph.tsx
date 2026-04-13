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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
      加载图谱…
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
    clearBrowsePath,
    clearRecommendedPaths,
    clearSelection,
  } = useGraphStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<NodeObject, LinkObject>>(undefined);
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether a new node was just selected so the auto-fit effect (nodes[])
  // skips its animated zoom and leaves centering/zooming to the [selectedNodeId] effect.
  const skipAutoFitZoomRef = useRef(false);
  const autoFitSkipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [zoomState, setZoomState] = useState<{ x: number; y: number; k: number }>({ x: dims.w / 2, y: dims.h / 2, k: 1 });
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

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
        const skipZoom = skipAutoFitZoomRef.current;
        // Account for right panel width when centering the graph
        // This shifts the "center" of the graph slightly to the left so it
        // remains visually centered when the right panel is open.
        // Note: we read rightPanelOpen from the store directly inside the effect
        // to avoid re-triggering this effect when the panel opens/closes.
        const panelOffset = useGraphStore.getState().rightPanelOpen ? 250 : 0;

        if (nodes.length <= 4) {
          // Few nodes: we've set fx/fy to 0 in buildGraphData.
          // Center the view at node origin (0,0) and use custom zoom.
          fgRef.current.centerAt(0, 0, 400);
          if (!skipZoom) {
            fgRef.current.zoom(nodes.length === 1 ? 1.5 : 1.0, 400);
          }
          // Re-clear cache so they don't jump back to old positions on next filter
          if ((globalThis as unknown as { _nodePosCache?: Map<string, { x: number; y: number }> })._nodePosCache) {
            nodes.forEach(n => (globalThis as unknown as { _nodePosCache: Map<string, { x: number; y: number }> })._nodePosCache.delete(n.id));
          }
        } else {
          // Multi-node: use standard zoomToFit with tighter padding.
          fgRef.current.centerAt(0, 0, 1);
          if (!skipZoom) {
            // Adjust padding to account for the right panel pushing the graph left
            fgRef.current.zoomToFit(400, 50 + panelOffset);
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

  // Pan to the selected node when it changes (e.g. from clicking a recommended path card)
  useEffect(() => {
    if (!selectedNodeId || !fgRef.current) return;
    const nodePos = (globalThis as unknown as { _nodePosCache?: Map<string, { x: number; y: number }> })._nodePosCache?.get(selectedNodeId);
    if (nodePos && nodePos.x != null && nodePos.y != null) {
      fgRef.current.centerAt(nodePos.x, nodePos.y, 400);
    }
  }, [selectedNodeId]);

  // When a node is selected, zoom in to show its neighborhood (≈20-25 nodes, readable titles).
  // Also sets skipAutoFitZoomRef so the [nodes] auto-fit effect defers to this centering.
  useEffect(() => {
    if (!selectedNodeId || !fgRef.current) return;
    // Signal the [nodes] auto-fit effect to skip its animated zoom, then clear
    // the flag after the auto-fit timeout fires so subsequent filter changes still auto-fit.
    skipAutoFitZoomRef.current = true;
    if (autoFitSkipTimerRef.current) clearTimeout(autoFitSkipTimerRef.current);
    autoFitSkipTimerRef.current = setTimeout(() => { skipAutoFitZoomRef.current = false; }, 200);

    const nodePos = (globalThis as unknown as { _nodePosCache?: Map<string, { x: number; y: number }> })._nodePosCache?.get(selectedNodeId);
    if (!nodePos || nodePos.x == null) return;
    // Center on selected node with tighter zoom (no zoomToFit — just center + zoom in)
    fgRef.current.centerAt(nodePos.x, nodePos.y, 300);
    fgRef.current.zoom(1.5, 300);
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

    // Center and zoom immediately for better UX
    if (node.x != null && node.y != null && fgRef.current) {
      // Signal the [nodes] auto-fit effect to skip its animated zoom
      skipAutoFitZoomRef.current = true;
      if (autoFitSkipTimerRef.current) clearTimeout(autoFitSkipTimerRef.current);
      autoFitSkipTimerRef.current = setTimeout(() => { skipAutoFitZoomRef.current = false; }, 200);

      fgRef.current.centerAt(node.x, node.y, 300);
      fgRef.current.zoom(1.5, 300);
    }

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
        clearSelection();
        setFocusMode(false);
      }
    }
  }, [browsePath.length, clearSelection, setFocusMode]);

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
      <ForceGraphErrorBoundary fgRef={fgRef}>
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
          if (!(globalThis as unknown as { _nodePosCache?: Map<string, { x: number; y: number }> })._nodePosCache) {
            (globalThis as unknown as { _nodePosCache: Map<string, { x: number; y: number }> })._nodePosCache = new Map();
          }
          (globalThis as unknown as { _nodePosCache: Map<string, { x: number; y: number }> })._nodePosCache.set(n.id, { x: n.x, y: n.y });

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
        }}
        linkWidth={(link: unknown) => {
          const l = link as { source: { id: string } | string; target: { id: string } | string };
          const sid = typeof l.source === 'object' ? (l.source as { id: string }).id : String(l.source);
          const tid = typeof l.target === 'object' ? (l.target as { id: string }).id : String(l.target);

          const isTrajectory = trailLinkSet.has(`${sid}→${tid}`) || trailLinkSet.has(`${tid}→${sid}`);
          if (isTrajectory) return 4;

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
      </ForceGraphErrorBoundary>

      <ClearConfirmDialog isOpen={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)} />
      <Tooltip tooltip={tooltip} />
    </div>
  );
}
