"use client";

/**
 * Centralized LIFO back-action registry for the mobile shell.
 *
 * Problem we're solving:
 *   Before this module, `OverlayContainer` in `primitives.tsx` manipulated
 *   `window.history` directly (pushState + popstate). When the user navigated
 *   inside an open sheet via `router.push`, the history stack became
 *   inconsistent ("user clicks inside sheet → lands back where they came
 *   from" bug). The header back button also inconsistently used
 *   `router.push` instead of `router.back`.
 *
 * How this module solves it:
 *   - Overlays, drawers, modals register a `handler` when they open.
 *   - The handler is simply "close me" (e.g. `setOpen(false)`).
 *   - A single Android hardware back listener (`backButton` from
 *     `@capacitor/app`) runs the top handler first; if nothing is
 *     registered, it delegates to router.back / exitApp.
 *   - iOS edge-swipe dismiss and the header back button go through the
 *     same path, so UX is identical everywhere.
 *
 * No `window.history` manipulation anywhere — the Next.js router owns the
 * stack; overlays are pure UI state.
 */

type Handler = () => boolean | void;

type Entry = { id: number; handler: Handler };

let uid = 0;
const stack: Entry[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Register a back handler. Returns an unregister function.
 * The most recently registered handler runs first (LIFO).
 *
 * @param handler - Return `true` if the handler consumed the back event
 *   (default). Return `false` to let the next handler or the router handle
 *   it instead.
 */
export function registerBackHandler(handler: Handler): () => void {
  const entry: Entry = { id: ++uid, handler };
  stack.push(entry);
  emit();
  return () => {
    const idx = stack.findIndex((e) => e.id === entry.id);
    if (idx >= 0) {
      stack.splice(idx, 1);
      emit();
    }
  };
}

/**
 * Run the top back handler, if any. Returns true if a handler ran and
 * consumed the event.
 */
export function runTopBackHandler(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  try {
    const result = top.handler();
    return result !== false;
  } catch {
    return false;
  }
}

/** Current registered depth — for debugging / exit-app heuristics. */
export function getBackStackDepth(): number {
  return stack.length;
}

/** Subscribe to stack changes (used by native-runtime for exit-app UX). */
export function subscribeBackStack(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
