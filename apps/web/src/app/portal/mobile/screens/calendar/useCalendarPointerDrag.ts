"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { EventRow } from "@/app/actions/events";
import { DEFAULT_EVENT_DURATION_MS, formatDateLocal } from "@/app/portal/calendar/date-utils";

const SNAP_MINUTES = 15;
const MOVE_HOLD_MS = 200;
const CREATE_HOLD_MS = 300;
const MOVE_CANCEL_PX = 8;

type DragMode = "move" | "resize" | "create";

type DragPreview = {
  mode: DragMode;
  dateStr: string;
  columnIndex: number;
  topPx: number;
  heightPx: number;
  startMinutes: number;
  endMinutes: number;
  eventId?: string;
};

type MovePending = {
  kind: "move";
  event: Pick<EventRow, "id" | "startAt" | "endAt" | "allDay">;
  startX: number;
  startY: number;
  startMinutes: number;
  durationMinutes: number;
  pointerOffsetMinutes: number;
  thresholdMs: number;
  timeoutId: number | null;
};

type ResizePending = {
  kind: "resize";
  event: Pick<EventRow, "id" | "startAt" | "endAt" | "allDay">;
  startX: number;
  startY: number;
  dateStr: string;
  columnIndex: number;
  startMinutes: number;
  thresholdMs: number;
  timeoutId: number | null;
};

type CreatePending = {
  kind: "create";
  startX: number;
  startY: number;
  dateStr: string;
  columnIndex: number;
  anchorMinutes: number;
  thresholdMs: number;
  timeoutId: number | null;
};

type PendingInteraction = MovePending | ResizePending | CreatePending;

type ActiveMove = {
  kind: "move";
  event: Pick<EventRow, "id" | "startAt" | "endAt" | "allDay">;
  durationMinutes: number;
  pointerOffsetMinutes: number;
};

type ActiveResize = {
  kind: "resize";
  event: Pick<EventRow, "id" | "startAt" | "endAt" | "allDay">;
  startMinutes: number;
  dateStr: string;
  columnIndex: number;
};

type ActiveCreate = {
  kind: "create";
  dateStr: string;
  columnIndex: number;
  anchorMinutes: number;
};

type ActiveInteraction = ActiveMove | ActiveResize | ActiveCreate;

export function useCalendarPointerDrag({
  visibleDays,
  scrollRef,
  dayColumnRefs,
  startHour,
  endHour,
  pixelsPerHour,
  enabled = true,
  onEventMove,
  onEventResize,
  onDragCreate,
}: {
  visibleDays: Date[];
  scrollRef: RefObject<HTMLElement | null>;
  dayColumnRefs: MutableRefObject<Array<HTMLElement | null>>;
  startHour: number;
  endHour: number;
  pixelsPerHour: number;
  enabled?: boolean;
  onEventMove?: (eventId: string, targetDateStr: string, startMinutesFromMidnight: number) => void;
  onEventResize?: (eventId: string, targetDateStr: string, endMinutesFromMidnight: number) => void;
  onDragCreate?: (
    targetDateStr: string,
    startMinutesFromMidnight: number,
    endMinutesFromMidnight: number,
  ) => void;
}) {
  const dayKeys = useMemo(() => visibleDays.map((day) => formatDateLocal(day)), [visibleDays]);
  const totalHeight = (endHour - startHour) * pixelsPerHour;
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [suppressClickEventId, setSuppressClickEventId] = useState<string | null>(null);

  const previewRef = useRef<DragPreview | null>(null);
  const pendingRef = useRef<PendingInteraction | null>(null);
  const activeRef = useRef<ActiveInteraction | null>(null);

  const clearPreview = useCallback(() => {
    previewRef.current = null;
    setPreview(null);
  }, []);

  const releasePending = useCallback(() => {
    const pending = pendingRef.current;
    if (pending?.timeoutId != null) {
      window.clearTimeout(pending.timeoutId);
    }
    pendingRef.current = null;
  }, []);

  const markSuppressClick = useCallback((eventId: string) => {
    setSuppressClickEventId(eventId);
    window.setTimeout(() => {
      setSuppressClickEventId((current) => (current === eventId ? null : current));
    }, 250);
  }, []);

  const getColumnByClientX = useCallback(
    (clientX: number) => {
      let closest: { dateStr: string; columnIndex: number; distance: number } | null = null;
      for (const [columnIndex, node] of dayColumnRefs.current.entries()) {
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          closest = { dateStr: dayKeys[columnIndex]!, columnIndex, distance: 0 };
          break;
        }
        const distance = Math.abs(clientX - (rect.left + rect.width / 2));
        if (!closest || distance < closest.distance) {
          closest = { dateStr: dayKeys[columnIndex]!, columnIndex, distance };
        }
      }
      return closest ? { dateStr: closest.dateStr, columnIndex: closest.columnIndex } : null;
    },
    [dayColumnRefs, dayKeys],
  );

  const snapMinutes = useCallback((minutes: number) => {
    return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
  }, []);

  const clampMinutes = useCallback(
    (minutes: number, minMinutes: number, maxMinutes: number) => {
      return Math.min(Math.max(minutes, minMinutes), maxMinutes);
    },
    [],
  );

  const getMinutesByClientY = useCallback(
    (clientY: number) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return null;
      const rect = scrollEl.getBoundingClientRect();
      const offsetY = clientY - rect.top + scrollEl.scrollTop;
      const clampedY = Math.min(Math.max(offsetY, 0), totalHeight);
      return clampMinutes(
        snapMinutes(startHour * 60 + (clampedY / pixelsPerHour) * 60),
        startHour * 60,
        endHour * 60,
      );
    },
    [clampMinutes, endHour, pixelsPerHour, scrollRef, snapMinutes, startHour, totalHeight],
  );

  const setPreviewState = useCallback((next: DragPreview | null) => {
    previewRef.current = next;
    setPreview(next);
  }, []);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const active = activeRef.current;
      if (!active) return;
      const pointerMinutes = getMinutesByClientY(clientY);
      if (pointerMinutes == null) return;

      if (active.kind === "create") {
        const minMinutes = Math.min(active.anchorMinutes, pointerMinutes);
        const maxMinutes = Math.max(active.anchorMinutes, pointerMinutes);
        const endMinutes = Math.max(minMinutes + SNAP_MINUTES, maxMinutes);
        setPreviewState({
          mode: "create",
          dateStr: active.dateStr,
          columnIndex: active.columnIndex,
          topPx: ((minMinutes - startHour * 60) / 60) * pixelsPerHour,
          heightPx: ((endMinutes - minMinutes) / 60) * pixelsPerHour,
          startMinutes: minMinutes,
          endMinutes,
        });
        return;
      }

      const column = getColumnByClientX(clientX);
      if (!column) return;

      if (active.kind === "move") {
        const maxStartMinutes = Math.max(startHour * 60, endHour * 60 - active.durationMinutes);
        const startMinutes = clampMinutes(
          snapMinutes(pointerMinutes - active.pointerOffsetMinutes),
          startHour * 60,
          maxStartMinutes,
        );
        const endMinutes = startMinutes + active.durationMinutes;
        setPreviewState({
          mode: "move",
          dateStr: column.dateStr,
          columnIndex: column.columnIndex,
          topPx: ((startMinutes - startHour * 60) / 60) * pixelsPerHour,
          heightPx: ((active.durationMinutes) / 60) * pixelsPerHour,
          startMinutes,
          endMinutes,
          eventId: active.event.id,
        });
        return;
      }

      const endMinutes = clampMinutes(
        Math.max(active.startMinutes + SNAP_MINUTES, pointerMinutes),
        active.startMinutes + SNAP_MINUTES,
        endHour * 60,
      );
      setPreviewState({
        mode: "resize",
        dateStr: column.dateStr,
        columnIndex: column.columnIndex,
        topPx: ((active.startMinutes - startHour * 60) / 60) * pixelsPerHour,
        heightPx: ((endMinutes - active.startMinutes) / 60) * pixelsPerHour,
        startMinutes: active.startMinutes,
        endMinutes,
        eventId: active.event.id,
      });
    },
    [
      clampMinutes,
      endHour,
      getColumnByClientX,
      getMinutesByClientY,
      pixelsPerHour,
      setPreviewState,
      snapMinutes,
      startHour,
    ],
  );

  const activatePending = useCallback(
    (pending: PendingInteraction) => {
      if (!enabled) return;
      if (pending.kind === "move") {
        activeRef.current = {
          kind: "move",
          event: pending.event,
          durationMinutes: pending.durationMinutes,
          pointerOffsetMinutes: pending.pointerOffsetMinutes,
        };
        setActiveEventId(pending.event.id);
      } else if (pending.kind === "resize") {
        activeRef.current = {
          kind: "resize",
          event: pending.event,
          startMinutes: pending.startMinutes,
          dateStr: pending.dateStr,
          columnIndex: pending.columnIndex,
        };
        setActiveEventId(pending.event.id);
      } else {
        activeRef.current = {
          kind: "create",
          dateStr: pending.dateStr,
          columnIndex: pending.columnIndex,
          anchorMinutes: pending.anchorMinutes,
        };
        setActiveEventId(null);
      }

      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(10);
      }
      document.body.style.userSelect = "none";
      document.body.style.touchAction = "none";
      updateFromPointer(pending.startX, pending.startY);
    },
    [enabled, updateFromPointer],
  );

  const finishInteraction = useCallback(
    (cancelled: boolean) => {
      releasePending();
      document.body.style.userSelect = "";
      document.body.style.touchAction = "";

      const active = activeRef.current;
      const finalPreview = previewRef.current;
      activeRef.current = null;
      setActiveEventId(null);
      clearPreview();

      if (cancelled || !active || !finalPreview) return;

      if (active.kind === "move") {
        markSuppressClick(active.event.id);
        onEventMove?.(active.event.id, finalPreview.dateStr, finalPreview.startMinutes);
        return;
      }

      if (active.kind === "resize") {
        markSuppressClick(active.event.id);
        onEventResize?.(active.event.id, finalPreview.dateStr, finalPreview.endMinutes);
        return;
      }

      onDragCreate?.(finalPreview.dateStr, finalPreview.startMinutes, finalPreview.endMinutes);
    },
    [
      clearPreview,
      markSuppressClick,
      onDragCreate,
      onEventMove,
      onEventResize,
      releasePending,
    ],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const pending = pendingRef.current;
      if (pending && !activeRef.current) {
        const deltaX = event.clientX - pending.startX;
        const deltaY = event.clientY - pending.startY;
        if (Math.hypot(deltaX, deltaY) > MOVE_CANCEL_PX) {
          releasePending();
          return;
        }
      }
      if (activeRef.current) {
        updateFromPointer(event.clientX, event.clientY);
      }
    };

    const handlePointerUp = () => finishInteraction(false);
    const handlePointerCancel = () => finishInteraction(true);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [finishInteraction, releasePending, updateFromPointer]);

  useEffect(() => {
    return () => {
      releasePending();
      activeRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.touchAction = "";
    };
  }, [releasePending]);

  const schedulePending = useCallback(
    (pending: PendingInteraction) => {
      releasePending();
      clearPreview();
      pendingRef.current = pending;
      if (pending.thresholdMs <= 0) {
        activatePending(pending);
        return;
      }
      pending.timeoutId = window.setTimeout(() => {
        if (pendingRef.current !== pending) return;
        pending.timeoutId = null;
        activatePending(pending);
      }, pending.thresholdMs);
    },
    [activatePending, clearPreview, releasePending],
  );

  const startMove = useCallback(
    (
      event: ReactPointerEvent,
      ev: Pick<EventRow, "id" | "startAt" | "endAt" | "allDay">,
    ) => {
      if (!enabled || ev.allDay || !onEventMove) return;
      const pointerMinutes = getMinutesByClientY(event.clientY);
      const start = new Date(ev.startAt);
      const end = ev.endAt
        ? new Date(ev.endAt)
        : new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const durationMinutes = Math.max(
        SNAP_MINUTES,
        Math.round((end.getTime() - start.getTime()) / 60_000),
      );
      schedulePending({
        kind: "move",
        event: ev,
        startX: event.clientX,
        startY: event.clientY,
        startMinutes,
        durationMinutes,
        pointerOffsetMinutes: Math.max(0, (pointerMinutes ?? startMinutes) - startMinutes),
        thresholdMs: MOVE_HOLD_MS,
        timeoutId: null,
      });
    },
    [enabled, getMinutesByClientY, onEventMove, schedulePending],
  );

  const startResize = useCallback(
    (
      event: ReactPointerEvent,
      ev: Pick<EventRow, "id" | "startAt" | "endAt" | "allDay">,
    ) => {
      if (!enabled || ev.allDay || !onEventResize) return;
      const dateStr = formatDateLocal(new Date(ev.startAt));
      const columnIndex = dayKeys.indexOf(dateStr);
      const start = new Date(ev.startAt);
      event.preventDefault();
      event.stopPropagation();
      schedulePending({
        kind: "resize",
        event: ev,
        startX: event.clientX,
        startY: event.clientY,
        dateStr,
        columnIndex: Math.max(0, columnIndex),
        startMinutes: start.getHours() * 60 + start.getMinutes(),
        thresholdMs: 0,
        timeoutId: null,
      });
    },
    [dayKeys, enabled, onEventResize, schedulePending],
  );

  const startCreate = useCallback(
    (event: ReactPointerEvent, dateStr: string) => {
      if (!enabled || !onDragCreate) return;
      const columnIndex = dayKeys.indexOf(dateStr);
      const pointerMinutes = getMinutesByClientY(event.clientY);
      if (pointerMinutes == null) return;
      schedulePending({
        kind: "create",
        startX: event.clientX,
        startY: event.clientY,
        dateStr,
        columnIndex: Math.max(0, columnIndex),
        anchorMinutes: pointerMinutes,
        thresholdMs: CREATE_HOLD_MS,
        timeoutId: null,
      });
    },
    [dayKeys, enabled, getMinutesByClientY, onDragCreate, schedulePending],
  );

  return {
    preview,
    activeEventId,
    suppressClickEventId,
    onEventPointerDown: startMove,
    onResizePointerDown: startResize,
    onSlotPointerDown: startCreate,
  };
}
