// web/components/graph/ForceGraph.tsx
'use client';

import { useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useGraphStore, GraphIndex } from '@/stores/graphStore';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
      加载图谱…
    </div>
  ),
});

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

type NodeLevel = 'focused' | 'level1' | 'level2' | 'peripheral';

interface GraphNode {
  id: string;
  title: string;
  domain: string;
  type: string;
  connections: number;
  x?: number;
  y?: number;
}

function getNodeLevel(
  nodeId: string,
  focusedNodeId: string | null,
  focusedNeighborIds: string[],
  graphIndex: GraphIndex | null,
): NodeLevel {
  if (!focusedNodeId || !graphIndex) return 'peripheral';
  if (nodeId === focusedNodeId) return 'focused';
  if (focusedNeighborIds.includes(nodeId)) return 'level1';

  // Level 2: neighbor of level1
  const l1Conns = focusedNeighborIds.flatMap(id =>
    graphIndex.index[id]?.connections.map((c: { noteId: string }) => c.noteId) ?? []
  );
  if (l1Conns.includes(nodeId)) return 'level2';

  return 'peripheral';
}

function getNodeVisual(level: NodeLevel, isSelected: boolean) {
  switch (level) {
    case 'focused':   return { alpha: 1.0, rBase: 8, rScale: isSelected ? 1.3 : 1.0 };
    case 'level1':    return { alpha: 0.7, rBase: 6, rScale: isSelected ? 1.2 : 0.95 };
    case 'level2':    return { alpha: 0.4, rBase: 4, rScale: isSelected ? 1.1 : 0.85 };
    default:          return { alpha: 0.15, rBase: 2, rScale: 1.0 };
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

  // Smooth breathing animation: update pulse at ~30fps, not every canvas frame
  const pulseRef = useRef(0);
  useEffect(() => {
    let raf: number;
    let last = 0;
    const animate = (t: number) => {
      if (t - last > 33) { // ~30fps cap
        pulseRef.current = 0.5 + 0.5 * Math.sin(t / 500);
        last = t;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { nodes, links } = buildGraphData(graphIndex, domainFilter, typeFilter, searchQuery);
  const trailNodeSet = new Set(highlightedTrailNodeIds);
  const trailLinkSet = new Set(
    highlightedTrailNodeIds.slice(0, -1).map((id, i) => `${id}→${highlightedTrailNodeIds[i + 1]}`)
  );

  const handleZoom = useCallback((transform: { k: number }) => {
    setCurrentScale(transform.k);
  }, [setCurrentScale]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    selectNode(node.id);
  }, [selectNode]);

  const handleNodeRightClick = useCallback((node: GraphNode) => {
    focusNode(node.id);
  }, [focusNode]);

  const handleBackgroundClick = useCallback(() => {
    selectNode(null);
    setFocusMode(false);
  }, [selectNode, setFocusMode]);

  const handleBackgroundRightClick = useCallback(() => {
    setFocusMode(false);
  }, [setFocusMode]);

  // Adjust width based on panel visibility
  const rightPanelWidth = (selectedNodeId || focusMode) ? 360 : 0;
  const canvasWidth = typeof window !== 'undefined' ? window.innerWidth - 280 - rightPanelWidth : 800;
  const canvasHeight = typeof window !== 'undefined' ? window.innerHeight - 52 : 600;

  return (
    <ForceGraph2D
      graphData={{ nodes, links }}
      width={canvasWidth}
      height={canvasHeight}
      onZoom={handleZoom as (transform: { k: number }) => void}
      nodeCanvasObject={(node: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const n = node as GraphNode & { x: number; y: number };
        const level = getNodeLevel(n.id, focusedNodeId, focusedNeighborIds, graphIndex);
        const visual = getNodeVisual(level, n.id === selectedNodeId);
        const maxConn = 10;
        const r = (visual.rBase + Math.min(n.connections / 2, maxConn)) * visual.rScale;
        const color = DOMAIN_COLORS[n.domain] ?? '#6B7280';

        ctx.globalAlpha = visual.alpha;

        // Breathing glow for focused nodes (reads from throttled pulse ref)
        if (level === 'focused') {
          const pulse = pulseRef.current;
          const glowR = r * (2.5 + pulse * 1.5);
          const grad = ctx.createRadialGradient(n.x, n.y, r * 0.8, n.x, n.y, glowR);
          grad.addColorStop(0, `rgba(0,245,255,${0.15 + pulse * 0.2})`);
          grad.addColorStop(0.5, `rgba(0,245,255,${0.05 + pulse * 0.1})`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Glow for selected node
        if (n.id === selectedNodeId && level !== 'focused') {
          const glowR = r * 2.5;
          const grad = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, glowR);
          grad.addColorStop(0, 'rgba(100,160,255,0.25)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Border
        if (n.id === selectedNodeId) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (level === 'focused') {
          ctx.strokeStyle = 'rgba(0,245,255,0.6)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Trail highlight: force full opacity and add bright cyan border for trail nodes
        if (trailNodeSet.has(n.id)) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#00F5FF';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.globalAlpha = 1;
        }

        // Labels (semantic zoom: only show at scale > 0.5 and not peripheral)
        if (level !== 'peripheral' && globalScale > 0.5) {
          const fontSize = Math.max(8, 11 / globalScale);
          ctx.font = `${fontSize}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#e0e0e0';
          const label = n.title.length > 18 ? n.title.slice(0, 17) + '…' : n.title;
          ctx.fillText(label, n.x, n.y + r + 2);
        }
      }}
      linkColor={(link: unknown) => {
        const l = link as { source: { id: string } | string; target: { id: string } | string };
        const sid = typeof l.source === 'object' ? (l.source as { id: string }).id : String(l.source);
        const tid = typeof l.target === 'object' ? (l.target as { id: string }).id : String(l.target);
        if (trailLinkSet.has(`${sid}→${tid}`) || trailLinkSet.has(`${tid}→${sid}`)) return '#00F5FF';
        return 'rgba(80,100,140,0.2)';
      }}
      linkWidth={(link: unknown) => {
        const l = link as { source: { id: string } | string; target: { id: string } | string };
        const sid = typeof l.source === 'object' ? (l.source as { id: string }).id : String(l.source);
        const tid = typeof l.target === 'object' ? (l.target as { id: string }).id : String(l.target);
        if (trailLinkSet.has(`${sid}→${tid}`) || trailLinkSet.has(`${tid}→${sid}`)) return 2;
        return 0.8;
      }}
      onNodeClick={handleNodeClick as (node: unknown) => void}
      onNodeRightClick={handleNodeRightClick as (node: unknown) => void}
      onBackgroundClick={handleBackgroundClick}
      onBackgroundRightClick={handleBackgroundRightClick}
      cooldownTicks={100}
      backgroundColor="#0A0B10"
    />
  );
}

function buildGraphData(
  index: GraphIndex | null,
  domainFilter: string,
  typeFilter: string,
  searchQuery: string,
): { nodes: GraphNode[]; links: Array<{ source: string; target: string; score?: number }> } {
  if (!index) return { nodes: [], links: [] };

  const q = searchQuery.toLowerCase();
  const nodes: GraphNode[] = [];
  const links: Array<{ source: string; target: string; score?: number }> = [];
  const seenNodes = new Set<string>();

  for (const [id, entry] of Object.entries(index.index)) {
    if (domainFilter && entry.domain !== domainFilter) continue;
    if (typeFilter && entry.type !== typeFilter) continue;
    if (q && !entry.title.toLowerCase().includes(q)) continue;

    if (!seenNodes.has(id)) {
      seenNodes.add(id);
      nodes.push({ id, title: entry.title, domain: entry.domain, type: entry.type, connections: entry.connections.length });
    }

    for (const conn of entry.connections) {
      if (!seenNodes.has(conn.noteId)) {
        seenNodes.add(conn.noteId);
        const target = index.index[conn.noteId];
        if (target) {
          nodes.push({ id: conn.noteId, title: target.title, domain: target.domain, type: target.type, connections: target.connections.length });
        }
      }
      links.push({ source: id, target: conn.noteId, score: conn.score });
    }
  }

  return { nodes, links };
}
