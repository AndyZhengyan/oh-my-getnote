// tools/indexer.ts

export interface NoteIndexEntry {
  id: string;
  path: string;
  type: string;
  title: string;
  tagTree: string[];
  bodyPreview?: string;
  connections: Array<{ noteId: string; score: number; type: string }>;
}

export interface TagNode {
  label: string;
  count: number;    // note count for this tag path
  tagCount: number;  // unique leaf tag count under this node
  children?: TagNode[];
}

export interface GraphIndex {
  version: '1.0';
  generated_at: string;
  archivePath?: string;
  index: Record<string, {
    path: string;
    type: string;
    title: string;
    tagTree: string[];
    bodyPreview?: string;
    connections: Array<{ noteId: string; score: number; type: string }>;
  }>;
  stats: {
    total_notes: number;
    total_connections: number;
    by_type: Record<string, number>;
    by_tagTree: Record<string, number>;
    tagTree: TagNode[];
  };
}

export function buildGraphIndex(entries: NoteIndexEntry[], archivePath?: string): GraphIndex {
  const byType: Record<string, number> = {};
  const byTagPath: Record<string, number> = {};
  let totalConnections = 0;

  const index: GraphIndex['index'] = {};

  for (const entry of entries) {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    totalConnections += entry.connections.length;

    for (const path of (entry.tagTree ?? [])) {
      byTagPath[path] = (byTagPath[path] || 0) + 1;
    }

    index[entry.id] = {
      path: entry.path,
      type: entry.type,
      title: entry.title,
      tagTree: entry.tagTree ?? [],
      bodyPreview: entry.bodyPreview,
      connections: entry.connections,
    };
  }

  // Build tree from flat paths: "L1 › L2 › L3" → nested nodes
  // Wrap everything under a virtual "全部笔记" L0 root
  function buildTree(paths: string[]): TagNode[] {
    const roots: TagNode[] = [];
    const map = new Map<string, TagNode>();

    // L0 root
    const l0: TagNode = { label: '全部笔记', count: 0, tagCount: 0, children: [] };
    map.set('全部笔记', l0);

    for (const p of paths) {
      const parts = p.split(' › ');
      let parentChildren: TagNode[] = l0.children!;
      let parentKey = '全部笔记';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const key = `${parentKey} › ${part}`;

        if (!map.has(key)) {
          const node: TagNode = { label: part, count: 0, tagCount: 0, children: i < parts.length - 1 ? [] : undefined };
          map.set(key, node);
          parentChildren.push(node);
        }

        map.get(key)!.count += byTagPath[p] ?? 0;
        parentChildren = map.get(key)!.children ?? parentChildren;
        parentKey = key;
      }
    }

    // Compute tagCount (unique leaf tag count) for each node
    function computeTagCount(nodes: TagNode[]): number {
      let leafCount = 0;
      for (const n of nodes) {
        if (!n.children || n.children.length === 0) {
          n.tagCount = 1;
          leafCount++;
        } else {
          n.tagCount = computeTagCount(n.children);
          leafCount += n.tagCount;
        }
      }
      return leafCount;
    }
    computeTagCount(l0.children!);
    l0.tagCount = l0.children!.reduce((acc, c) => acc + c.tagCount, 0);

    return [l0];
  }

  const sortedPaths = Object.keys(byTagPath).sort();
  const tree = buildTree(sortedPaths);

  return {
    version: '1.0',
    generated_at: new Date().toISOString(),
    archivePath,
    index,
    stats: {
      total_notes: entries.length,
      total_connections: totalConnections,
      by_type: byType,
      by_tagTree: byTagPath,
      tagTree: tree,
    },
  };
}
