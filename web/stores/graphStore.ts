// web/stores/graphStore.ts
'use client';

import { create } from 'zustand';

export interface NoteIndexEntry {
  path: string;
  domain: string;
  type: string;
  title: string;
  bodyPreview?: string;
  connections: Array<{ noteId: string; score: number; type: string }>;
}

export interface GraphIndex {
  version: string;
  generated_at: string;
  domains: string[];
  index: Record<string, NoteIndexEntry>;
  archivePath?: string;
  stats: {
    total_notes: number;
    total_connections: number;
    by_domain: Record<string, number>;
    by_type: Record<string, number>;
  };
}

export interface TrailStep {
  noteId: string;
  timestamp: string;
}

export interface Trail {
  id: string;
  name: string;
  createdAt: string;
  steps: TrailStep[];
}

export interface RecommendedPath {
  noteId: string;
  title: string;
  domain: string;
  domainColor: string;
  type: string;
  score: number;
  compositeScore: number;
  text: string;
  explanation: string;
  whyFrom: string[];
  isSaved: boolean;
  bodyPreview?: string;
  connections: Array<{ noteId: string; score: number; type: string }>;
}

/** Simple event bus for graph operations */
let _resetFn: (() => void) | null = null;
let _heatFn: (() => void) | null = null;
let _trailAnimTimer: ReturnType<typeof setTimeout> | null = null;
export function registerGraphReset(fn: () => void) { _resetFn = fn; }
export function unregisterGraphReset() { _resetFn = null; }
export function registerGraphHeat(fn: () => void) { _heatFn = fn; }
export function unregisterGraphHeat() { _heatFn = null; }
export function triggerGraphReset() { _resetFn?.(); }
export function triggerGraphHeat() { _heatFn?.(); }

interface GraphState {
  graphIndex: GraphIndex | null;
  loaded: boolean;
  error: string | null;
  domainFilter: string;
  typeFilter: string;
  searchQuery: string;
  selectedNodeId: string | null;
  focusedNodeId: string | null;
  focusedNeighborIds: Set<string>;
  focusMode: boolean;
  currentScale: number;
  browsePath: string[];
  browsePathShow: boolean;
  savedTrails: Trail[];
  highlightedTrailId: string | null;
  highlightedTrailNodeIds: string[];
  _trailAnimPlaying: boolean;
  setGraphIndex: (index: GraphIndex) => void;
  setDomainFilter: (domain: string) => void;
  setTypeFilter: (type: string) => void;
  setSearchQuery: (query: string) => void;
  selectNode: (id: string | null) => void;
  focusNode: (id: string | null) => void;
  setFocusMode: (on: boolean) => void;
  setCurrentScale: (scale: number) => void;
  clearBrowsePath: () => void;
  setBrowsePathShow: (show: boolean) => void;
  removeFromBrowsePath: (id: string) => void;
  setBrowsePath: (path: string[]) => void;
  saveTrail: (name: string, stepsOverride?: TrailStep[]) => void;
  loadTrails: () => void;
  deleteTrail: (id: string) => void;
  playTrail: (id: string) => void;
  stopTrailPlayback: () => void;
  // Panel visibility
  multiHopPanelOpen: boolean;
  setMultiHopPanelOpen: (open: boolean) => void;
  // Recommended paths for multi-hop search
  recommendedPaths: RecommendedPath[];
  setRecommendedPaths: (paths: RecommendedPath[]) => void;
  clearRecommendedPaths: () => void;
  markPathSaved: (noteId: string) => void;
}

function loadFromStorage(): Trail[] {
  try {
    const stored = localStorage.getItem('memex_trails');
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveToStorage(trails: Trail[]) {
  localStorage.setItem('memex_trails', JSON.stringify(trails.slice(0, 20)));
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graphIndex: null, loaded: false, error: null,
  domainFilter: '', typeFilter: '', searchQuery: '',
  selectedNodeId: null,
  focusedNodeId: null, focusedNeighborIds: new Set<string>(), focusMode: false, currentScale: 1,
  browsePath: [],
  browsePathShow: false,
  savedTrails: [],
  highlightedTrailId: null, highlightedTrailNodeIds: [], _trailAnimPlaying: false,
  multiHopPanelOpen: false,
  recommendedPaths: [],

  setGraphIndex: (index) => set({ graphIndex: index, loaded: true }),
  setDomainFilter: (domain) => set({ domainFilter: domain }),
  setTypeFilter: (type) => set({ typeFilter: type }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectNode: (id) => {
    const state = get();
    if (id && state.browsePath.includes(id)) {
      const idx = state.browsePath.indexOf(id);
      if (idx === 0) {
        // Clicking the first node again returns to empty path
        set({ selectedNodeId: id, browsePath: [] });
      } else {
        set({ selectedNodeId: id, browsePath: state.browsePath.slice(0, idx + 1) });
      }
    } else {
      set({ selectedNodeId: id, browsePath: id ? [...state.browsePath, id] : [] });
    }
  },
  focusNode: (id) => set(state => ({
    focusedNodeId: id,
    focusMode: id !== null,
    focusedNeighborIds: id
      ? new Set(state.graphIndex?.index[id]?.connections.map(c => c.noteId) ?? [])
      : new Set<string>(),
  })),
  setFocusMode: (on) => set({ focusMode: on, focusedNodeId: null, focusedNeighborIds: new Set<string>() }),
  setCurrentScale: (scale) => set({ currentScale: scale }),

  clearBrowsePath: () => set({ browsePath: [] }),
  setBrowsePathShow: (show) => set({ browsePathShow: show }),
  removeFromBrowsePath: (id) => set(state => {
    const idx = state.browsePath.indexOf(id);
    if (idx === -1) return {};
    return { browsePath: state.browsePath.slice(0, idx) };
  }),
  setBrowsePath: (path) => set({ browsePath: path }),
  saveTrail: (name, stepsOverride) => {
    const state = get();
    if (!name.trim()) return;
    const trail: Trail = {
      id: `trail_${Date.now()}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      steps: stepsOverride ?? state.browsePath.map(noteId => ({ noteId, timestamp: new Date().toISOString() })),
    };
    const trails = [trail, ...state.savedTrails].slice(0, 20);
    saveToStorage(trails);
    set({ savedTrails: trails });
  },
  loadTrails: () => {
    const trails = loadFromStorage();
    set({ savedTrails: trails });
  },
  deleteTrail: (id) => {
    const trails = get().savedTrails.filter(t => t.id !== id);
    saveToStorage(trails);
    set({ savedTrails: trails });
  },
  playTrail: (id) => {
    const trail = get().savedTrails.find(t => t.id === id);
    if (!trail) return;
    const nodeIds = trail.steps.map(s => s.noteId);

    // Cancel any in-progress sequential animation
    if (_trailAnimTimer !== null) {
      clearTimeout(_trailAnimTimer);
      _trailAnimTimer = null;
    }

    // Sequential animation: highlight nodes one by one every 500ms
    set({ highlightedTrailId: id, highlightedTrailNodeIds: [], _trailAnimPlaying: true });

    let index = 0;
    function step() {
      // Guard: stop was requested or trail changed
      const state = get();
      if (!state._trailAnimPlaying || state.highlightedTrailId !== id) return;

      if (index < nodeIds.length) {
        set({ highlightedTrailNodeIds: nodeIds.slice(0, index + 1) });
        index++;
        _trailAnimTimer = setTimeout(step, 500);
      } else {
        _trailAnimTimer = null;
      }
    }
    step();
  },
  stopTrailPlayback: () => {
    if (_trailAnimTimer !== null) {
      clearTimeout(_trailAnimTimer);
      _trailAnimTimer = null;
    }
    set({ highlightedTrailId: null, highlightedTrailNodeIds: [], _trailAnimPlaying: false });
  },

  setMultiHopPanelOpen: (open) => set({ multiHopPanelOpen: open }),

  setRecommendedPaths: (paths) => set({ recommendedPaths: paths }),
  clearRecommendedPaths: () => set({ recommendedPaths: [] }),
  markPathSaved: (noteId) =>
    set(state => ({
      recommendedPaths: state.recommendedPaths.map(p =>
        p.noteId === noteId ? { ...p, isSaved: true } : p,
      ),
    })),
}));
