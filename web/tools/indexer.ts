// tools/indexer.ts

export interface NoteIndexEntry {
  id: string;
  path: string;
  domain: string;
  type: string;
  title: string;
  bodyPreview?: string;
  connections: Array<{ noteId: string; score: number; type: string }>;
}

export interface GraphIndex {
  version: '1.0';
  generated_at: string;
  domains: string[];
  index: Record<string, {
    path: string;
    domain: string;
    type: string;
    title: string;
    bodyPreview?: string;
    connections: Array<{ noteId: string; score: number; type: string }>;
  }>;
  stats: {
    total_notes: number;
    total_connections: number;
    by_domain: Record<string, number>;
    by_type: Record<string, number>;
  };
}

export function buildGraphIndex(entries: NoteIndexEntry[]): GraphIndex {
  const domainsSet = new Set<string>();
  const byDomain: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let totalConnections = 0;

  const index: GraphIndex['index'] = {};

  for (const entry of entries) {
    domainsSet.add(entry.domain);
    byDomain[entry.domain] = (byDomain[entry.domain] || 0) + 1;
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    totalConnections += entry.connections.length;

    index[entry.id] = {
      path: entry.path,
      domain: entry.domain,
      type: entry.type,
      title: entry.title,
      bodyPreview: entry.bodyPreview,
      connections: entry.connections,
    };
  }

  return {
    version: '1.0',
    generated_at: new Date().toISOString(),
    domains: Array.from(domainsSet),
    index,
    stats: {
      total_notes: entries.length,
      total_connections: totalConnections,
      by_domain: byDomain,
      by_type: byType,
    },
  };
}
