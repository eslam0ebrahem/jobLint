import 'fake-indexeddb/auto';
import { beforeEach, vi } from 'vitest';
import { resetDatabaseForTests } from '@/src/infrastructure/database/job-repository';

type Listener = (message: unknown) => void;
const storage = new Map<string, unknown>();
const listeners = new Set<Listener>();

const browserMock = {
  storage: {
    local: {
      get: vi.fn(async (keys?: string | string[]) => {
        if (keys === undefined) return Object.fromEntries(storage);
        const names = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(names.filter((name) => storage.has(name)).map((name) => [name, storage.get(name)]));
      }),
      set: vi.fn(async (values: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(values)) storage.set(key, value);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) storage.delete(key);
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(async () => ({ ok: true, data: null })),
    onMessage: {
      addListener: vi.fn((listener: Listener) => listeners.add(listener)),
      removeListener: vi.fn((listener: Listener) => listeners.delete(listener)),
    },
  },
  tabs: {
    query: vi.fn(async () => []),
    sendMessage: vi.fn(async () => null),
    create: vi.fn(async () => undefined),
  },
  scripting: {
    executeScript: vi.fn(async () => []),
  },
};

Object.defineProperty(globalThis, 'browser', { value: browserMock, configurable: true, writable: true });

beforeEach(async () => {
  storage.clear();
  listeners.clear();
  await resetDatabaseForTests();
});
