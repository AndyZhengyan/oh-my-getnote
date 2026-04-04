// web/components/graph/ForceGraph.tsx
'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useGraphStore, GraphIndex } from '@/stores/graphStore';
import { registerGraphReset, registerGraphHeat, unregisterGraphReset, unregisterGraphHeat } from '@/stores/graphStore';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
      加载图谱…
    </div>
  ),
});

const DOMAIN_COLORS: Record<string, string> = {
  'AI 核心技术与模型':     '#6366F1',
  'AI 产业生态与巨头':    '#8B5CF6',
  'AI 智能体与工程':      '#10B981',
  '管理、职场与个人成长':  '#F59E0B',
  '行业应用与生活闲谈':   '#EC4899',
  '企业数字化与数据治理':  '#3B82F6',
  '社会、安全与伦理':      '#A855F7',
  '其他':                  '#9CA3AF',
};

type NodeLevel = 'focused' | 'level1' | 'level2' | 'peripheral' | 'ghost';

interface GraphNode {
  id: string;
  title: string;
  domain: string;
  type: string;
  connections: number;
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
 * Click focus (left-click): selected + direct neighbors visible, rest → ghost.
 * Right-click focus (2-hop): focused + 2-hop neighbourhood, rest → ghost.
 */
export function getNodeLevel(
  nodeId: string,
  selectedNodeId: string | null,
  focusedNodeId: string | null,
  focusedNeighborIds: string[],
  graphIndex: GraphIndex | null,
): NodeLevel {
  // Left-click: selected node + 1-hop neighbors
  if (selectedNodeId) {
    if (nodeId === selectedNodeId) return 'focused';
    const neighbors = graphIndex?.index[selectedNodeId]?.connections.map(c => c.noteId) ?? [];
    if (neighbors.includes(nodeId)) return 'level1';
    return 'ghost';
  }
  // Right-click: focused node + 2-hop neighbourhood
  if (!focusedNodeId || !graphIndex) return 'peripheral';
  if (nodeId === focusedNodeId) return 'focused';
  if (focusedNeighborIds.includes(nodeId)) return 'level1';
  const l1Conns = focusedNeighborIds.flatMap(id =>
    graphIndex.index[id]?.connections.map((c: { noteId: string }) => c.noteId) ?? []
  );
  if (l1Conns.includes(nodeId)) return 'level2';
  return 'ghost';
}

function getNodeVisual(level: NodeLevel) {
  switch (level) {
    case 'focused': return { alpha: 1.0, rBase: 8, rScale: 1.0, ghost: false };
    case 'level1':  return { alpha: 0.85, rBase: 5, rScale: 1.0, ghost: false };
    case 'level2':  return { alpha: 0.5, rBase: 4, rScale: 0.85, ghost: false };
    case 'ghost':    return { alpha: 0.04, rBase: 2, rScale: 0.5, ghost: true };
    default:         return { alpha: 0.85, rBase: 3, rScale: 1.0, ghost: false };
  }
}

export default function ForceGraph() {
  const {
    graphIndex, domainFilter, typeFilter, searchQuery,
    selectedNodeId, selectNode,
    focusedNodeId, focusedNeighborIds, focusMode,
    currentScale, setCurrentScale, focusNode, setFocusMode,
    highlightedTrailNodeIds,
  } = useGraphStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { nodes, links } = useMemo(
    () => buildGraphData(graphIndex, domainFilter, typeFilter, searchQuery, selectedNodeId, focusedNodeId, focusedNeighborIds),
    [graphIndex, domainFilter, typeFilter, searchQuery, selectedNodeId, focusedNodeId, focusedNeighborIds]
  );

  // Register reset and heat functions with the global event system
  useEffect(() => {
    registerGraphReset(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(800, 100);
        fgRef.current.d3ReheatSimulation();
      }
    });
    registerGraphHeat(() => {
      if (fgRef.current) {
        // Heat simulation but DON'T zoom — let the force layout handle it
        fgRef.current.d3ReheatSimulation();
      }
    });
    return () => {
      unregisterGraphReset();
      unregisterGraphHeat();
    };
  }, []);

  // Auto-fit after data changes (e.g. filter / click), but only once
  const prevNodesLen = useRef(nodes.length);
  useEffect(() => {
    if (fgRef.current && nodes.length > 0 && prevNodesLen.current !== nodes.length) {
      prevNodesLen.current = nodes.length;
      setTimeout(() => {
        if (!fgRef.current) return;
        // Use appropriate padding based on node count — larger padding = smaller view
        const padding = nodes.length < 5 ? 350 : nodes.length < 10 ? 250 : nodes.length < 20 ? 150 : 100;
        fgRef.current.centerAt(dims.w / 2, dims.h / 2, 1);
        fgRef.current.zoomToFit(800, padding);
        fgRef.current.d3ReheatSimulation();
      }, 100);
    }
  }, [nodes, dims]);

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
    highlightedTrailNodeIds.slice(0, -1).map((id, i) => `${id}→${highlightedTrailNodeIds[i + 1]}`)
  ), [highlightedTrailNodeIds]);

  // Node hover detection via proximity
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !graphIndex) return;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let closest: TooltipState | null = null;
    let closestDist = 25;

    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      const level = getNodeLevel(node.id, selectedNodeId, focusedNodeId, focusedNeighborIds, graphIndex);
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
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          title: node.title,
          domain: node.domain,
          snippet: node.connections > 0 ? `${node.connections} 条关联` : '暂无关联',
        };
      }
    }
    setTooltip(closest);
  }, [nodes, graphIndex, selectedNodeId, focusedNodeId, focusedNeighborIds]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleZoom = useCallback((transform: { k: number }) => {
    requestAnimationFrame(() => {
      setCurrentScale(Math.min(transform.k, MAX_ZOOM));
    });
  }, [setCurrentScale]);

  // Cap auto-zoom after nodes change — don't zoom in too much
  const MAX_ZOOM = 2.5;
  useEffect(() => {
    if (fgRef.current && nodes.length > 0) {
      const checkZoom = () => {
        if (!fgRef.current) return;
        const currentTransform = fgRef.current.zoom();
        if (currentTransform.k > MAX_ZOOM) {
          fgRef.current.zoom(800, MAX_ZOOM);
        }
      };
      setTimeout(checkZoom, 1200);
    }
  }, [nodes]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    // Prevent selecting ghost (peripheral dimmed) nodes
    const level = getNodeLevel(node.id, selectedNodeId, focusedNodeId, focusedNeighborIds, graphIndex);
    if (level === 'ghost') return;
    selectNode(node.id);
  }, [selectNode, selectedNodeId, focusedNodeId, focusedNeighborIds, graphIndex]);

  const handleNodeRightClick = useCallback((node: GraphNode) => {
    focusNode(node.id);
  }, [focusNode]);

  const handleBackgroundClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'CANVAS') {
      selectNode(null);
      setFocusMode(false);
    }
  }, [selectNode, setFocusMode]);

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
          const n = node as GraphNode & { x?: number; y?: number };
          if (n.x == null || n.y == null) return;

          const level = getNodeLevel(n.id, selectedNodeId, focusedNodeId, focusedNeighborIds, graphIndex);
          const visual = getNodeVisual(level);
          const maxConn = 10;
          const r = (visual.rBase + Math.min(n.connections / 2, maxConn)) * visual.rScale;
          const color = DOMAIN_COLORS[n.domain] ?? '#9CA3AF';

          ctx.globalAlpha = visual.alpha;

          // Halo
          if (level === 'focused' || n.id === selectedNodeId) {
            const haloR = r * 3.5;
            const grad = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, haloR);
            grad.addColorStop(0, 'rgba(124,58,237,0.22)');
            grad.addColorStop(1, 'rgba(124,58,237,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
            ctx.fill();
          }

          // Node circle
          const nodeColor = n.id === selectedNodeId || level === 'focused' ? '#7C3AED' : color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fillStyle = nodeColor;
          ctx.fill();

          if (n.id === selectedNodeId) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Trail highlight
          if (trailNodeSet.has(n.id)) {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#7C3AED';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }

          // Label — only for visible nodes
          if (!visual.ghost) {
            const baseFontSize = 9;
            const fontSize = Math.max(7, Math.min(baseFontSize / globalScale, 11));
            ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = level === 'focused' ? '#7C3AED' : '#9CA3AF';

            // Dim labels when zoomed out, clearer when zoomed in
            ctx.globalAlpha = visual.alpha * (globalScale > 1 ? 0.7 : 0.3 + globalScale * 0.4);

            const label = n.title.length > 22 ? n.title.slice(0, 21) + '…' : n.title;
            ctx.fillText(label, n.x, n.y + r + 4);
          }
          ctx.globalAlpha = 1;
        }}
        linkColor={(link: unknown) => {
          const l = link as { source: { id: string } | string; target: { id: string } | string };
          const sid = typeof l.source === 'object' ? (l.source as { id: string }).id : String(l.source);
          const tid = typeof l.target === 'object' ? (l.target as { id: string }).id : String(l.target);

          // Ghost check: if either endpoint is a "ghost" node, don't show the link
          const sLevel = getNodeLevel(sid, selectedNodeId, focusedNodeId, focusedNeighborIds, graphIndex);
          const tLevel = getNodeLevel(tid, selectedNodeId, focusedNodeId, focusedNeighborIds, graphIndex);
          if (sLevel === 'ghost' || tLevel === 'ghost') return 'rgba(0,0,0,0)';

          // Trail edges always visible
          if (trailLinkSet.has(`${sid}→${tid}`) || trailLinkSet.has(`${tid}→${sid}`)) return '#7C3AED';
          // When a node is selected: only show edges within focal set
          if (selectedNodeId || focusMode) {
            const neighbors = selectedNodeId
              ? (graphIndex?.index[selectedNodeId]?.connections.map(c => c.noteId) ?? [])
              : focusedNeighborIds;
            if (neighbors.includes(sid) || neighbors.includes(tid)) {
              return sid === (selectedNodeId ?? focusedNodeId) || tid === (selectedNodeId ?? focusedNodeId)
                ? '#7C3AED'
                : 'rgba(124,58,237,0.25)';
            }
            return 'rgba(0,0,0,0.01)';
          }
          return 'rgba(0,0,0,0.07)';
        }}
        linkWidth={(link: unknown) => {
          const l = link as { source: { id: string } | string; target: { id: string } | string };
          const sid = typeof l.source === 'object' ? (l.source as { id: string }).id : String(l.source);
          const tid = typeof l.target === 'object' ? (l.target as { id: string }).id : String(l.target);

          const sLevel = getNodeLevel(sid, selectedNodeId, focusedNodeId, focusedNeighborIds, graphIndex);
          const tLevel = getNodeLevel(tid, selectedNodeId, focusedNodeId, focusedNeighborIds, graphIndex);
          if (sLevel === 'ghost' || tLevel === 'ghost') return 0;

          if (trailLinkSet.has(`${sid}→${tid}`) || trailLinkSet.has(`${tid}→${sid}`)) return 2;
          if (selectedNodeId || focusMode) {
            const neighbors = selectedNodeId
              ? (graphIndex?.index[selectedNodeId]?.connections.map(c => c.noteId) ?? [])
              : focusedNeighborIds;
            if (neighbors.includes(sid) || neighbors.includes(tid)) return sid === (selectedNodeId ?? focusedNodeId) || tid === (selectedNodeId ?? focusedNodeId) ? 1.5 : 0.8;
            return 0.3;
          }
          return 0.6;
        }}
        onNodeClick={handleNodeClick as (node: unknown) => void}
        onNodeRightClick={handleNodeRightClick as (node: unknown) => void}
        onBackgroundClick={handleBackgroundClick as (e: MouseEvent) => void}
        onBackgroundRightClick={handleBackgroundRightClick}
        cooldownTicks={800}
        backgroundColor="#F8F9FB"
      />

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
            borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
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
  selectedNodeId: string | null,
  focusedNodeId: string | null,
  focusedNeighborIds: string[],
): { nodes: GraphNode[]; links: Array<{ source: string; target: string; score?: number }> } {
  if (!index) return { nodes: [], links: [] };

  const q = searchQuery.toLowerCase();
  const nodes: GraphNode[] = [];
  const links: Array<{ source: string; target: string; score?: number }> = [];
  const seenNodes = new Set<string>();

  // Helper to determine if a node should exist in the data structure
  const isExcluded = (id: string) => {
    const level = getNodeLevel(id, selectedNodeId, focusedNodeId, focusedNeighborIds, index);
    return level === 'ghost';
  };

  // First pass: identify all nodes that pass filters AND are not "ghosts"
  const activeIds = new Set<string>();
  for (const [id, entry] of Object.entries(index.index)) {
    if (domainFilter && entry.domain !== domainFilter) continue;
    if (typeFilter && entry.type !== typeFilter) continue;
    if (q && !entry.title.toLowerCase().includes(q) && !entry.bodyPreview?.toLowerCase().includes(q)) continue;
    if (isExcluded(id)) continue;
    activeIds.add(id);
  }

  // Second pass: build nodes and links
  for (const id of activeIds) {
    const entry = index.index[id]!;
    if (!seenNodes.has(id)) {
      seenNodes.add(id);
      nodes.push({ id, title: entry.title, domain: entry.domain, type: entry.type, connections: entry.connections.length });
    }

    for (const conn of entry.connections) {
      if (activeIds.has(conn.noteId)) {
        links.push({ source: id, target: conn.noteId, score: conn.score });
      }
    }
  }

  return { nodes, links };
}
