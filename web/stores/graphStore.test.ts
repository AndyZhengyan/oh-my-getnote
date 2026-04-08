// web/stores/graphStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGraphStore } from './graphStore';

// Mock localStorage — only needed for saveTrail / loadTrails / deleteTrail
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  get length() { return Object.keys(mockStorage).length; },
  key: (i: number) => Object.keys(mockStorage)[i] ?? null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

describe('graphStore — trajectory features', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);

    // Reset module-level animation variables
    vi.clearAllTimers();
    useGraphStore.setState({ _trailAnimPlaying: false });

    useGraphStore.setState({
      browsePath: [],
      savedTrails: [],
      highlightedTrailId: null,
      highlightedTrailNodeIds: [],
      selectedNodeId: null,
    });
  });

  // -------------------------------------------------------------------------
  // Bug 1 (LeftNav): savedTrails is reactive — saveTrail updates the store
  // -------------------------------------------------------------------------
  it('saveTrail updates savedTrails in store', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-a');
    store.selectNode('node-b');
    store.saveTrail('My Trail');

    const { savedTrails } = useGraphStore.getState();
    expect(savedTrails).toHaveLength(1);
    expect(savedTrails[0].name).toBe('My Trail');
    expect(savedTrails[0].steps).toHaveLength(2);
    expect(savedTrails[0].steps[0].noteId).toBe('node-a');
    expect(savedTrails[0].steps[1].noteId).toBe('node-b');
  });

  it('loadTrails restores savedTrails from localStorage', () => {
    // Pre-populate localStorage mock
    mockStorage.memex_trails = JSON.stringify([{
      id: 'restored_trail',
      name: 'Restored Trail',
      createdAt: '2026-01-01T00:00:00.000Z',
      steps: [{ noteId: 'n1', timestamp: '2026-01-01T00:00:00.000Z' }],
    }]);

    const store = useGraphStore.getState();
    store.loadTrails();

    const { savedTrails } = useGraphStore.getState();
    expect(savedTrails).toHaveLength(1);
    expect(savedTrails[0].name).toBe('Restored Trail');
  });

  it('loadTrails when localStorage is empty gives empty array', () => {
    const store = useGraphStore.getState();
    store.loadTrails();

    expect(useGraphStore.getState().savedTrails).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Bug 2: stopTrailPlayback clears highlighted state
  // -------------------------------------------------------------------------
  it('stopTrailPlayback clears highlightedTrailId and highlightedTrailNodeIds', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-in-trail');
    store.saveTrail('Trail to Play');

    const trailId = useGraphStore.getState().savedTrails[0].id;
    store.playTrail(trailId);

    expect(useGraphStore.getState().highlightedTrailId).toBe(trailId);
    expect(useGraphStore.getState().highlightedTrailNodeIds.length).toBeGreaterThan(0);

    store.stopTrailPlayback();

    const { highlightedTrailId, highlightedTrailNodeIds } = useGraphStore.getState();
    expect(highlightedTrailId).toBeNull();
    expect(highlightedTrailNodeIds).toHaveLength(0);
  });

  it('playTrail sets highlighted state from saved trail', () => {
    const store = useGraphStore.getState();
    store.selectNode('step-node');
    store.saveTrail('Playback Trail');

    const trailId = useGraphStore.getState().savedTrails[0].id;
    store.playTrail(trailId);

    const { highlightedTrailId, highlightedTrailNodeIds } = useGraphStore.getState();
    expect(highlightedTrailId).toBe(trailId);
    expect(highlightedTrailNodeIds).toEqual(['step-node']);
  });

  // -------------------------------------------------------------------------
  // clearBrowsePath clears browsePath
  // -------------------------------------------------------------------------
  it('clearBrowsePath clears browsePath even when discarding', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-x');
    store.selectNode('node-y');

    expect(useGraphStore.getState().browsePath).toEqual(['node-x', 'node-y']);

    store.clearBrowsePath();

    const { browsePath } = useGraphStore.getState();
    expect(browsePath).toHaveLength(0);
  });

  it('saveTrail with valid name saves browsePath and keeps it intact', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-a');
    store.saveTrail('Valid Name');

    const { browsePath, savedTrails } = useGraphStore.getState();
    expect(browsePath).toHaveLength(1);
    expect(savedTrails[0].name).toBe('Valid Name');
    expect(savedTrails[0].steps[0].noteId).toBe('node-a');
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  it('deleteTrail removes trail from savedTrails', () => {
    const store = useGraphStore.getState();
    store.saveTrail('To Delete');

    const trailId = useGraphStore.getState().savedTrails[0].id;
    store.deleteTrail(trailId);

    expect(useGraphStore.getState().savedTrails).toHaveLength(0);
  });

  it('selectNode always affects browsePath', () => {
    const store = useGraphStore.getState();
    store.selectNode('any-node');

    const { browsePath, selectedNodeId } = useGraphStore.getState();
    expect(browsePath).toEqual(['any-node']);
    expect(selectedNodeId).toBe('any-node');
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  it('playTrail with non-existent id does nothing', () => {
    const store = useGraphStore.getState();
    store.saveTrail('Real Trail');
    const realTrailId = useGraphStore.getState().savedTrails[0].id;

    // Attempt to play a trail that does not exist
    store.playTrail('non_existent_id_12345');

    const { highlightedTrailId, highlightedTrailNodeIds, _trailAnimPlaying } = useGraphStore.getState();
    expect(highlightedTrailId).toBeNull();
    expect(highlightedTrailNodeIds).toHaveLength(0);
    expect(_trailAnimPlaying).toBe(false);
  });

  it('deleteTrail with non-existent id does nothing to savedTrails', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-x');
    store.saveTrail('Existing Trail');

    const { savedTrails } = useGraphStore.getState();
    expect(savedTrails).toHaveLength(1);

    // Attempt to delete a trail that does not exist
    store.deleteTrail('non_existent_id_12345');

    const { savedTrails: after } = useGraphStore.getState();
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(savedTrails[0].id);
  });

  it('stopTrailPlayback when nothing is playing does nothing (no crash)', () => {
    const store = useGraphStore.getState();
    // Ensure store is in a clean state
    expect(useGraphStore.getState().highlightedTrailId).toBeNull();

    // Calling stop when nothing is playing must not crash and must leave state unchanged
    store.stopTrailPlayback();

    const { highlightedTrailId, highlightedTrailNodeIds, _trailAnimPlaying } = useGraphStore.getState();
    expect(highlightedTrailId).toBeNull();
    expect(highlightedTrailNodeIds).toHaveLength(0);
    expect(_trailAnimPlaying).toBe(false);
  });

  it('saveTrail writes the trail to localStorage key memex_trails', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-p');
    store.selectNode('node-q');
    store.saveTrail('LocalStorage Trail');

    const stored = mockStorage['memex_trails'];
    expect(stored).toBeDefined();
    const parsed: Array<{ id: string; name: string; steps: Array<{ noteId: string }> }> = JSON.parse(stored);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('LocalStorage Trail');
    expect(parsed[0].steps[0].noteId).toBe('node-p');
    expect(parsed[0].steps[1].noteId).toBe('node-q');
  });
});

describe('browsePath — auto-trace behavior', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.clearAllTimers();
    useGraphStore.setState({
      browsePath: [],
      savedTrails: [],
      selectedNodeId: null,
      highlightedTrailId: null,
      highlightedTrailNodeIds: [],
      _trailAnimPlaying: false,
    });
  });

  it('clicking a node adds it to browsePath', () => {
    useGraphStore.getState().selectNode('node-a');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a']);
  });

  it('clicking second node appends to browsePath', () => {
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b']);
  });

  it('clicking same node again removes it and subsequent', () => {
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    useGraphStore.getState().selectNode('node-a'); // 再点 node-a → 移除
    expect(useGraphStore.getState().browsePath).toEqual([]);
  });

  it('clicking middle node truncates path after it', () => {
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    useGraphStore.getState().selectNode('node-c');
    useGraphStore.getState().selectNode('node-b'); // 截断到 node-b
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b']);
  });

  it('last node is always the selected node', () => {
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    expect(useGraphStore.getState().selectedNodeId).toBe('node-b');
  });

  it('clearBrowsePath resets browsePath', () => {
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    useGraphStore.getState().clearBrowsePath();
    expect(useGraphStore.getState().browsePath).toEqual([]);
  });
});
