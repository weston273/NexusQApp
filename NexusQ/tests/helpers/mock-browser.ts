type StorageMap = Map<string, string>;

export function installMockBrowser() {
  const store: StorageMap = new Map();
  const dispatchedEvents: string[] = [];

  const localStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };

  if (typeof globalThis.CustomEvent === "undefined") {
    class MockCustomEvent<T = unknown> extends Event {
      detail: T;

      constructor(type: string, init?: CustomEventInit<T>) {
        super(type);
        this.detail = init?.detail as T;
      }
    }

    globalThis.CustomEvent = MockCustomEvent as typeof CustomEvent;
  }

  const windowMock = {
    localStorage,
    dispatchEvent(event: Event) {
      dispatchedEvents.push(event.type);
      return true;
    },
    addEventListener() {
      return undefined;
    },
    removeEventListener() {
      return undefined;
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: windowMock,
  });

  return {
    localStorage,
    store,
    dispatchedEvents,
    reset() {
      store.clear();
      dispatchedEvents.length = 0;
    },
    cleanup() {
      Reflect.deleteProperty(globalThis, "window");
    },
  };
}
