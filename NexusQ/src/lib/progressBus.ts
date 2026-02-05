// src/lib/progressBus.ts
type Handler = (ms?: number) => void;

const handlers = new Set<Handler>();

export function onProgress(handler: Handler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function triggerProgress(ms?: number) {
  handlers.forEach((h) => h(ms));
}
