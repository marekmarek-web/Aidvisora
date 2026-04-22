/**
 * The back stack uses module-level state. Tests MUST unregister every handler
 * they push; `runTopBackHandler` does NOT pop entries — in production the
 * handler itself (via React useEffect cleanup) calls the unregister function.
 * Running under the default node vitest env; native-back-stack is DOM-free.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getBackStackDepth,
  registerBackHandler,
  runTopBackHandler,
  subscribeBackStack,
} from "../native-back-stack";

const pending: Array<() => void> = [];

function track(unregister: () => void) {
  pending.push(unregister);
  return unregister;
}

afterEach(() => {
  while (pending.length > 0) {
    const fn = pending.pop();
    fn?.();
  }
  // Safety — should always be 0 already.
  if (getBackStackDepth() !== 0) {
    throw new Error(`test leaked back-stack entries: ${getBackStackDepth()}`);
  }
});

describe("registerBackHandler", () => {
  it("increments and decrements stack depth", () => {
    expect(getBackStackDepth()).toBe(0);
    const unregister = track(registerBackHandler(() => {}));
    expect(getBackStackDepth()).toBe(1);
    unregister();
    pending.pop();
    expect(getBackStackDepth()).toBe(0);
  });

  it("runs the top handler first (LIFO) and keeps running the same top until unregistered", () => {
    const first = vi.fn();
    const second = vi.fn();
    track(registerBackHandler(first));
    track(registerBackHandler(second));
    expect(runTopBackHandler()).toBe(true);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    // Second is still the top — handlers don't auto-pop.
    expect(runTopBackHandler()).toBe(true);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("after the top handler unregisters, the next-top runs", () => {
    const first = vi.fn();
    const second = vi.fn();
    track(registerBackHandler(first));
    const unregisterSecond = registerBackHandler(second);
    runTopBackHandler();
    expect(second).toHaveBeenCalledTimes(1);
    unregisterSecond();
    runTopBackHandler();
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("returns false when handler returns false — back event not consumed", () => {
    track(registerBackHandler(() => false));
    expect(runTopBackHandler()).toBe(false);
  });

  it("default return (undefined) is treated as consumed", () => {
    track(registerBackHandler(() => {}));
    expect(runTopBackHandler()).toBe(true);
  });

  it("swallows handler exceptions so they don't crash native bridge", () => {
    track(
      registerBackHandler(() => {
        throw new Error("boom");
      }),
    );
    expect(() => runTopBackHandler()).not.toThrow();
    expect(runTopBackHandler()).toBe(false);
  });
});

describe("subscribeBackStack", () => {
  it("notifies on register and unregister", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBackStack(listener);
    try {
      const unregister = registerBackHandler(() => {});
      expect(listener).toHaveBeenCalledTimes(1);
      unregister();
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
    }
    track(registerBackHandler(() => {}));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("runTopBackHandler with empty stack", () => {
  it("returns false when no handler registered", () => {
    expect(runTopBackHandler()).toBe(false);
  });
});
