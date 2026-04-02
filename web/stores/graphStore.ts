// web/stores/graphStore.ts
'use client';

import { create } from 'zustand';

export interface NoteIndexEntry {
  path: string;
  domain: string;
  type: string;
  title: string;
  connections: Array<{ noteId: string; score: number; type: string }>;
}

export interface GraphIndex {
  version: string;
  generated_at: string;
  domains: string[];
  index: Record<string, NoteIndexEntry>;
  stats: {
    total_notes: number;
    total_connections: number;
    by_domain: Record<string, number>;
    by_type: Record<string, number>;
  };
}

interface GraphState {
  graphIndex: GraphIndex | null;
  loaded: boolean;
  error: string | null;
  domainFilter: string;
  typeFilter: string;
  searchQuery: string;
  selectedNodeId: string | null;
  focusedNodeId: string | null;
  trailRecording: boolean;
  currentTrail: string[];
  setGraphIndex: (index: GraphIndex) => void;
  setDomainFilter: (domain: string) => void;
  setTypeFilter: (type: string) => void;
  setSearchQuery: (query: string) => void;
  selectNode: (id: string | null) => void;
  focusNode: (id: string | null) => void;
  startTrail: () => void;
  addToTrail: (id: string) => void;
  finishTrail: () => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  graphIndex: null,
  loaded: false,
  error: null,
  domainFilter: '',
  typeFilter: '',
  searchQuery: '',
  selectedNodeId: null,
  focusedNodeId: null,
  trailRecording: false,
  currentTrail: [],
  setGraphIndex: (index) => set({ graphIndex: index, loaded: true }),
  setDomainFilter: (domain) => set({ domainFilter: domain }),
  setTypeFilter: (type) => set({ typeFilter: type }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectNode: (id) => set({ selectedNodeId: id }),
  focusNode: (id) => set({ focusedNodeId: id }),
  startTrail: () => set({ trailRecording: true, currentTrail: [] }),
  addToTrail: (id) =>
    set((state) => ({ currentTrail: [...state.currentTrail, id] })),
  finishTrail: () => set({ trailRecording: false }),
}));
