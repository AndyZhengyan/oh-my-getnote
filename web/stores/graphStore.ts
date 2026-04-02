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
  // Data
  graphIndex: GraphIndex | null;
  loaded: boolean;
  error: string | null;

  // Filters
  domainFilter: string;
  typeFilter: string;
  searchQuery: string;

  // Selection
  selectedNodeId: string | null;
  focusedNodeId: string | null;
  focusedNeighborIds: string[];

  // Focus mode
  focusMode: boolean;
  currentScale: number;

  // Trail
  trailRecording: boolean;
  currentTrail: string[];

  // Actions
  setGraphIndex: (index: GraphIndex) => void;
  setDomainFilter: (domain: string) => void;
  setTypeFilter: (type: string) => void;
  setSearchQuery: (query: string) => void;
  selectNode: (id: string | null) => void;
  focusNode: (id: string | null) => void;
  setFocusMode: (on: boolean) => void;
  setCurrentScale: (scale: number) => void;
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
  focusedNeighborIds: [],

  focusMode: false,
  currentScale: 1,

  trailRecording: false,
  currentTrail: [],

  setGraphIndex: (index) => set({ graphIndex: index, loaded: true }),

  setDomainFilter: (domain) => set({ domainFilter: domain }),
  setTypeFilter: (type) => set({ typeFilter: type }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  selectNode: (id) => set({ selectedNodeId: id }),
  focusNode: (id) => set((state) => ({
    focusedNodeId: id,
    focusMode: id !== null,
    focusedNeighborIds: id
      ? (state.graphIndex?.index[id]?.connections.map((c: { noteId: string }) => c.noteId) ?? [])
      : [],
  })),
  setFocusMode: (on) => set({ focusMode: on, focusedNodeId: null, focusedNeighborIds: [] }),
  setCurrentScale: (scale) => set({ currentScale: scale }),

  startTrail: () => set({ trailRecording: true, currentTrail: [] }),
  addToTrail: (id) =>
    set((state) => ({ currentTrail: [...state.currentTrail, id] })),
  finishTrail: () => set({ trailRecording: false }),
}));
