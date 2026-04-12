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

  it('saveTrail with empty name does nothing', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-a');
    store.saveTrail('');

    expect(useGraphStore.getState().savedTrails).toHaveLength(0);
  });

  it('saveTrail with whitespace-only name does nothing', () => {
    const store = useGraphStore.getState();
    store.selectNode('node-a');
    store.saveTrail('   ');

    expect(useGraphStore.getState().savedTrails).toHaveLength(0);
  });

  it('loadTrails called twice replaces the list (not duplicates)', () => {
    mockStorage.memex_trails = JSON.stringify([{
      id: 'trail-1', name: 'First', createdAt: '2026-01-01T00:00:00.000Z',
      steps: [{ noteId: 'n1', timestamp: '2026-01-01T00:00:00.000Z' }],
    }]);
    const store = useGraphStore.getState();
    store.loadTrails();
    expect(useGraphStore.getState().savedTrails).toHaveLength(1);

    mockStorage.memex_trails = JSON.stringify([{
      id: 'trail-2', name: 'Second', createdAt: '2026-01-02T00:00:00.000Z',
      steps: [{ noteId: 'n2', timestamp: '2026-01-02T00:00:00.000Z' }],
    }]);
    store.loadTrails();
    expect(useGraphStore.getState().savedTrails).toHaveLength(1);
    expect(useGraphStore.getState().savedTrails[0].name).toBe('Second');
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

  it('clicking same node again keeps path and opens panel', () => {
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    useGraphStore.getState().selectNode('node-a'); // 再点 node-a → 保持路径不变
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b', 'node-a']);
  });

  it('clicking middle node appends to path (no truncation)', () => {
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    useGraphStore.getState().selectNode('node-c');
    useGraphStore.getState().selectNode('node-b'); // 追加 node-b 到末尾
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b', 'node-c', 'node-b']);
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

  it('removeFromBrowsePath removes only that node (not subsequent)', () => {
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    useGraphStore.getState().selectNode('node-c');
    useGraphStore.getState().removeFromBrowsePath('node-b');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-c']);
  });

  it('previewNode changes selectedNodeId without modifying browsePath', () => {
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    useGraphStore.getState().previewNode('node-c');
    expect(useGraphStore.getState().selectedNodeId).toBe('node-c');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b']); // 路径不变
  });

  it('previewNode(null) closes panel without clearing selection', () => {
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().previewNode(null);
    expect(useGraphStore.getState().rightPanelOpen).toBe(false);
    expect(useGraphStore.getState().selectedNodeId).toBe('node-a'); // 保持选中
    expect(useGraphStore.getState().browsePath).toEqual(['node-a']);
  });

  it('clearSelection clears everything', () => {
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    useGraphStore.getState().clearSelection();
    expect(useGraphStore.getState().selectedNodeId).toBe(null);
    expect(useGraphStore.getState().browsePath).toEqual([]);
    expect(useGraphStore.getState().rightPanelOpen).toBe(false);
  });
});

// ============================================================
// 场景测试：完整用户流程
// ============================================================

describe('场景测试 — 完整用户流程', () => {
  beforeEach(() => {
    // 每次测试前重置 store
    useGraphStore.setState({
      selectedNodeId: null,
      browsePath: [],
      rightPanelOpen: false,
      savedTrails: [],
      highlightedTrailId: null,
      highlightedTrailNodeIds: [],
    });
  });

  it('场景1: 图谱点击多个节点 → 路径正确追加', () => {
    // 点击节点 A → 路径: [A]
    useGraphStore.getState().selectNode('node-a');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a']);
    expect(useGraphStore.getState().selectedNodeId).toBe('node-a');
    expect(useGraphStore.getState().rightPanelOpen).toBe(true);

    // 点击节点 B → 路径: [A, B]
    useGraphStore.getState().selectNode('node-b');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b']);
    expect(useGraphStore.getState().selectedNodeId).toBe('node-b');

    // 点击节点 C → 路径: [A, B, C]
    useGraphStore.getState().selectNode('node-c');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b', 'node-c']);
  });

  it('场景2: 删除中间节点后自动连线 → 路径保持顺序', () => {
    // 建立路径: [A, B, C, D]
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    useGraphStore.getState().selectNode('node-c');
    useGraphStore.getState().selectNode('node-d');

    // 删除中间节点 B → 路径: [A, C, D]（保持顺序）
    useGraphStore.getState().removeFromBrowsePath('node-b');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-c', 'node-d']);

    // 删除最后一个节点 D → 路径: [A, C]
    useGraphStore.getState().removeFromBrowsePath('node-d');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-c']);
  });

  it('场景3: 搜索点击节点追加到链路 → 始终追加不截断', () => {
    // 从图谱建立路径: [A, B]
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b']);

    // 从搜索点击节点 C（已存在的节点）→ 追加而非截断，路径: [A, B, C]
    useGraphStore.getState().selectNode('node-c');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b', 'node-c']);

    // 再点击 A → 路径: [A, B, C, A]
    useGraphStore.getState().selectNode('node-a');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b', 'node-c', 'node-a']);
  });

  it('场景4: 左侧轨迹点击只预览不改变链路', () => {
    // 建立当前路径: [A, B, C]
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    useGraphStore.getState().selectNode('node-c');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b', 'node-c']);

    // 点击历史轨迹中的节点 D（previewNode）→ 路径不变
    useGraphStore.getState().previewNode('node-d');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b', 'node-c']);
    expect(useGraphStore.getState().selectedNodeId).toBe('node-d'); // 但选中了 D
    expect(useGraphStore.getState().rightPanelOpen).toBe(true);

    // 再点击另一个节点 E → 路径依然不变
    useGraphStore.getState().previewNode('node-e');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b', 'node-c']);
    expect(useGraphStore.getState().selectedNodeId).toBe('node-e');
  });

  it('场景4补充: 预览模式下关闭面板 → 保持选中状态', () => {
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().previewNode('node-b');

    // 关闭面板
    useGraphStore.getState().previewNode(null);
    expect(useGraphStore.getState().rightPanelOpen).toBe(false);
    expect(useGraphStore.getState().selectedNodeId).toBe('node-b'); // 保持选中
    expect(useGraphStore.getState().browsePath).toEqual(['node-a']);
  });

  it('综合: 完整用户旅程', () => {
    // 1. 从图谱点击建立路径
    useGraphStore.getState().selectNode('node-a');
    useGraphStore.getState().selectNode('node-b');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b']);

    // 2. 关闭右侧面板查看图谱（保持选中）
    useGraphStore.getState().selectNode(null);
    expect(useGraphStore.getState().rightPanelOpen).toBe(false);
    expect(useGraphStore.getState().selectedNodeId).toBe('node-b');

    // 3. 再次点击同一节点 → 只打开面板
    useGraphStore.getState().selectNode('node-b');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b']);

    // 4. 从搜索点击新节点
    useGraphStore.getState().selectNode('node-c');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-b', 'node-c']);

    // 5. 左侧删除中间节点
    useGraphStore.getState().removeFromBrowsePath('node-b');
    expect(useGraphStore.getState().browsePath).toEqual(['node-a', 'node-c']);

    // 6. 保存轨迹
    useGraphStore.getState().saveTrail('测试轨迹');
    expect(useGraphStore.getState().savedTrails).toHaveLength(1);
    expect(useGraphStore.getState().savedTrails[0].steps).toHaveLength(2);

    // 7. 清空选择
    useGraphStore.getState().clearSelection();
    expect(useGraphStore.getState().selectedNodeId).toBe(null);
    expect(useGraphStore.getState().browsePath).toEqual([]);
  });
});
