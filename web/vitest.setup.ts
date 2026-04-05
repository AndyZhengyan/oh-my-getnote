// web/vitest.setup.ts
// Mock localStorage for tests — applies to both global and direct localStorage references
const store: Record<string, string> = {};

function createLocalStorageMock() {
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

global.localStorage = createLocalStorageMock();
// Also set it on the global scope in case modules reference it differently
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).localStorage = global.localStorage;
