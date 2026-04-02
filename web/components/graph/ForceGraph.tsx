// web/components/graph/ForceGraph.tsx
'use client';

import { useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useGraphStore } from '@/stores/graphStore';

// react-force-graph-2d 不能 SSR，动态导入
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', color: 'var(--text-muted)', fontSize: 14,
    }}>
      加载图谱…
    </div>
  ),
},);

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

interface GraphNode {
  id: string;
  title: string;
  domain: string;
  type: string;
  connections: number;
  x?: number;
  y?: number;
}

export default function ForceGraph() {
  const fgRef = useRef<{ d3Force: (name: string) => { strength: (n: number) => void } | null } | null>(null);
  const {
    graphIndex, domainFilter, typeFilter, searchQuery,
    selectedNodeId, selectNode,
  } = useGraphStore();

  // 构建节点和边
  const { nodes, links } = buildGraphData(graphIndex, domainFilter, typeFilter, searchQuery);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force?.('charge')?.strength?.(-80);
      fgRef.current.d3Force?.('link')?.distance?.(60);
    }
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    selectNode(node.id);
  }, [selectNode]);

  const handleBackgroundClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <ForceGraph2D
      ref={fgRef as React.Ref<unknown>}
      graphData={{ nodes, links }}
      width={typeof window !== 'undefined' ? window.innerWidth - 280 - 360 : 800}
      height={typeof window !== 'undefined' ? window.innerHeight - 52 : 600}
      nodeCanvasObject={(node: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const n = node as GraphNode & { x: number; y: number };
        const r = 6 + Math.min(n.connections / 2, 12);
        const color = DOMAIN_COLORS[n.domain] ?? '#6B7280';
        const isSelected = n.id === selectedNodeId;

        if (isSelected) {
          const grad = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r * 2.5);
          grad.addColorStop(0, 'rgba(0,245,255,0.25)');
          grad.addColorStop(1, 'rgba(0,245,255,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r * (isSelected ? 1.2 : 1), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;

        if (isSelected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }}
      linkColor={() => 'rgba(80,100,140,0.2)'}
      linkWidth={0.8}
      onNodeClick={handleNodeClick as (node: unknown) => void}
      onBackgroundClick={handleBackgroundClick}
      cooldownTicks={100}
      backgroundColor="#0A0B10"
    />
  );
}

function buildGraphData(
  index: ReturnType<typeof useGraphStore>['graphIndex'],
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
      nodes.push({
        id,
        title: entry.title,
        domain: entry.domain,
        type: entry.type,
        connections: entry.connections.length,
      });
    }

    for (const conn of entry.connections) {
      if (!seenNodes.has(conn.noteId)) {
        seenNodes.add(conn.noteId);
        const target = index.index[conn.noteId];
        if (target) {
          nodes.push({
            id: conn.noteId,
            title: target.title,
            domain: target.domain,
            type: target.type,
            connections: target.connections.length,
          });
        }
      }
      links.push({ source: id, target: conn.noteId, score: conn.score });
    }
  }

  return { nodes, links };
}
