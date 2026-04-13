// web/stores/graphStore.ts
'use client';

import { create } from 'zustand';

export interface TagNode {
  label: string;
  count: number;
  tagCount: number;
  children?: TagNode[];
}

export interface NoteIndexEntry {
  path: string;
  type: string;
  title: string;
  tagTree: string[];
  bodyPreview?: string;
  createdAt?: string;
  tags?: string[];
  connections: Array<{ noteId: string; score: number; type: string }>;
}

export interface GraphIndex {
  version: string;
  generated_at: string;
  index: Record<string, NoteIndexEntry>;
  archivePath?: string;
  stats: {
    total_notes: number;
    total_connections: number;
    by_type: Record<string, number>;
    by_tagTree: Record<string, number>;
    tagTree: TagNode[];
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
let _trailAnimTimer: ReturnType<typeof setTimeout> | null = null;

// Internal event bus references (to be initialized by the store)
type ResetFn = () => void;
type HeatFn = () => void;
let _triggerGraphReset: ResetFn = () => {};
let _triggerGraphHeat: HeatFn = () => {};

export const registerGraphReset = (fn: () => void) => { _triggerGraphReset = fn; };
export const unregisterGraphReset = () => { _triggerGraphReset = () => {}; };
export const registerGraphHeat = (fn: () => void) => { _triggerGraphHeat = fn; };
export const unregisterGraphHeat = () => { _triggerGraphHeat = () => {}; };
export const triggerGraphReset = () => _triggerGraphReset();
export const triggerGraphHeat = () => _triggerGraphHeat();

interface GraphState {
  graphIndex: GraphIndex | null;
  loaded: boolean;
  error: string | null;
  typeFilter: string;
  tagTreeFilter: string;
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
  setTypeFilter: (type: string) => void;
  setTagTreeFilter: (path: string) => void;
  setSearchQuery: (query: string) => void;
  selectNode: (id: string | null) => void;
  clearSelection: () => void;
  previewNode: (id: string | null) => void;
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
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;
  leftNavOpen: boolean;
  setLeftNavOpen: (open: boolean) => void;
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
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

export const useGraphStore = create<GraphState>((set, get) => {
  // Initialize the internal event bus functions
  _triggerGraphReset = () => {
    set({ selectedNodeId: null, focusedNodeId: null, focusMode: false, focusedNeighborIds: new Set<string>(), highlightedTrailId: null, highlightedTrailNodeIds: [], _trailAnimPlaying: false });
  };
  _triggerGraphHeat = () => {
    // Heat logic placeholder
    console.log('Graph heat triggered');
  };

  return {
    graphIndex: null, loaded: false, error: null,
    typeFilter: '', tagTreeFilter: '', searchQuery: '',
    selectedNodeId: null,
    focusedNodeId: null, focusedNeighborIds: new Set<string>(), focusMode: false, currentScale: 1,
    browsePath: [],
    browsePathShow: false,
    savedTrails: [],
    highlightedTrailId: null, highlightedTrailNodeIds: [], _trailAnimPlaying: false,
    multiHopPanelOpen: false,
    recommendedPaths: [],
    rightPanelOpen: false,
    leftNavOpen: true,
    searchModalOpen: false,

    setGraphIndex: (index) => set({ graphIndex: index, loaded: true }),
    setTypeFilter: (type) => set({ typeFilter: type }),
    setTagTreeFilter: (path) => set({ tagTreeFilter: path }),
    setSearchQuery: (query) => set({ searchQuery: query }),
  selectNode: (id) => {
    const state = get();
    // If clicking the same node, just open panel (don't remove from path)
    if (id !== null && state.selectedNodeId === id) {
      set({ rightPanelOpen: true });
      return;
    }
    // If id is null, just close panel (keep selection state)
    if (id === null) {
      set({ rightPanelOpen: false });
      return;
    }

    // Always append to path to preserve the full exploration sequence
    set({ selectedNodeId: id, browsePath: [...state.browsePath, id], rightPanelOpen: true });
  },
  clearSelection: () => {
    set({ selectedNodeId: null, browsePath: [], rightPanelOpen: false });
  },
  previewNode: (id) => {
    // Preview a node without modifying browsePath - just open panel
    if (id === null) {
      set({ rightPanelOpen: false });
    } else {
      set({ selectedNodeId: id, rightPanelOpen: true });
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
    // Just remove this specific node, keep the rest in order
    const idx = state.browsePath.indexOf(id);
    if (idx === -1) return {};
    return { browsePath: state.browsePath.filter(n => n !== id) };
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
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setLeftNavOpen: (open) => set({ leftNavOpen: open }),
  setSearchModalOpen: (open) => set({ searchModalOpen: open }),

  setRecommendedPaths: (paths) => set({ recommendedPaths: paths }),
  clearRecommendedPaths: () => set({ recommendedPaths: [] }),
  markPathSaved: (noteId) =>
    set(state => ({
      recommendedPaths: state.recommendedPaths.map(p =>
        p.noteId === noteId ? { ...p, isSaved: true } : p,
      ),
    })),
  };
});
