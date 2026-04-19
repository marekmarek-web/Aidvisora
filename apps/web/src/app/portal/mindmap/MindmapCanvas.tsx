"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { MindmapNode, MindmapEdge, ViewportState } from "./types";

const DRAG_THRESHOLD_PX = 10;
const DOUBLE_TAP_MS = 320;

function getCanvasSize() {
  if (typeof window === "undefined") return 5000;
  return window.innerWidth < 768 ? 3000 : 5000;
}

type DragCandidate = {
  nodeId: string;
  startClientX: number;
  startClientY: number;
  offsetX: number;
  offsetY: number;
};

type MindmapCanvasProps = {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  viewport: ViewportState;
  selectedNodeId: string | null;
  onViewportChange: (v: Partial<ViewportState>) => void;
  onNodePositionChange: (id: string, x: number, y: number) => void;
  /** Single tap / click end without drag — selection only (no editor). */
  onNodeTap: (id: string) => void;
  /** Double tap (touch) or double click (mouse) — open editor. */
  onNodeOpenEditor: (id: string) => void;
  onCanvasClick: () => void;
  renderNode: (node: MindmapNode, opts: { isDragging: boolean; isSelected: boolean }) => React.ReactNode;
};

export function MindmapCanvas({
  nodes,
  edges,
  viewport,
  selectedNodeId,
  onViewportChange,
  onNodePositionChange,
  onNodeTap,
  onNodeOpenEditor,
  onCanvasClick,
  renderNode,
}: MindmapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef<{ dist: number; zoom: number; midX: number; midY: number } | null>(null);
  const [canvasSize] = useState(getCanvasSize);
  const dragCandidateRef = useRef<DragCandidate | null>(null);
  const lastTapRef = useRef<{ nodeId: string; t: number } | null>(null);
  /** So window pointer listeners attach when only a ref (drag candidate) is set. */
  const [pointerSession, setPointerSession] = useState(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, nodeId?: string) => {
      if (e.button !== 0) return;
      if (nodeId) {
        e.stopPropagation();
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;
        dragCandidateRef.current = {
          nodeId,
          startClientX: e.clientX,
          startClientY: e.clientY,
          offsetX: (e.clientX - viewport.pan.x) / viewport.zoom - node.x,
          offsetY: (e.clientY - viewport.pan.y) / viewport.zoom - node.y,
        };
        setPointerSession(true);
      } else {
        dragCandidateRef.current = null;
        setIsPanning(true);
        setPointerSession(true);
        startPosRef.current = { x: e.clientX - viewport.pan.x, y: e.clientY - viewport.pan.y };
        onCanvasClick();
      }
    },
    [nodes, viewport, onCanvasClick]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const cand = dragCandidateRef.current;
      if (cand && !draggingNodeId) {
        const dx = e.clientX - cand.startClientX;
        const dy = e.clientY - cand.startClientY;
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
          setDraggingNodeId(cand.nodeId);
          startPosRef.current = { x: cand.offsetX, y: cand.offsetY };
          dragCandidateRef.current = null;
        }
        return;
      }
      if (draggingNodeId) {
        const newX = (e.clientX - viewport.pan.x) / viewport.zoom - startPosRef.current.x;
        const newY = (e.clientY - viewport.pan.y) / viewport.zoom - startPosRef.current.y;
        onNodePositionChange(draggingNodeId, newX, newY);
      } else if (isPanning) {
        onViewportChange({
          pan: {
            x: e.clientX - startPosRef.current.x,
            y: e.clientY - startPosRef.current.y,
          },
        });
      }
    },
    [viewport, onViewportChange, onNodePositionChange, draggingNodeId, isPanning]
  );

  const finishNodePointer = useCallback(
    (nodeId: string) => {
      const now = Date.now();
      const last = lastTapRef.current;
      if (last && last.nodeId === nodeId && now - last.t < DOUBLE_TAP_MS) {
        lastTapRef.current = null;
        onNodeOpenEditor(nodeId);
      } else {
        lastTapRef.current = { nodeId, t: now };
        onNodeTap(nodeId);
      }
    },
    [onNodeTap, onNodeOpenEditor]
  );

  const handlePointerUp = useCallback(() => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
      dragCandidateRef.current = null;
      setPointerSession(false);
      setIsPanning(false);
      return;
    }
    const cand = dragCandidateRef.current;
    if (cand) {
      dragCandidateRef.current = null;
      finishNodePointer(cand.nodeId);
    }
    setIsPanning(false);
    setPointerSession(false);
  }, [draggingNodeId, finishNodePointer]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => handlePointerMove(e as unknown as React.PointerEvent);
    const onUp = () => handlePointerUp();
    if (draggingNodeId || isPanning || pointerSession) {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
    }
  }, [draggingNodeId, isPanning, pointerSession, handlePointerMove, handlePointerUp]);

  const ZOOM_MIN = 0.4;
  const ZOOM_MAX = 2;
  const WHEEL_ZOOM_SENSITIVITY = 0.002;

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!containerRef.current) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const delta = -e.deltaY * WHEEL_ZOOM_SENSITIVITY;
      const newZoom = Math.min(Math.max(viewport.zoom + delta, ZOOM_MIN), ZOOM_MAX);
      if (newZoom === viewport.zoom) return;
      const pointX = (cursorX - viewport.pan.x) / viewport.zoom;
      const pointY = (cursorY - viewport.pan.y) / viewport.zoom;
      const newPanX = cursorX - pointX * newZoom;
      const newPanY = cursorY - pointY * newZoom;
      onViewportChange({ zoom: newZoom, pan: { x: newPanX, y: newPanY } });
    },
    [viewport, onViewportChange]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function dist(a: Touch, b: Touch) {
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const rect = el!.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        pinchRef.current = { dist: d, zoom: viewport.zoom, midX, midY };
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const scale = d / pinchRef.current.dist;
        const newZoom = Math.min(Math.max(pinchRef.current.zoom * scale, ZOOM_MIN), ZOOM_MAX);
        if (newZoom === viewport.zoom) return;
        const { midX, midY } = pinchRef.current;
        const pointX = (midX - viewport.pan.x) / viewport.zoom;
        const pointY = (midY - viewport.pan.y) / viewport.zoom;
        onViewportChange({
          zoom: newZoom,
          pan: { x: midX - pointX * newZoom, y: midY - pointY * newZoom },
        });
      }
    }

    function handleTouchEnd() {
      pinchRef.current = null;
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [viewport, onViewportChange]);

  const renderEdges = () => {
    return edges.map((edge) => {
      const source = nodes.find((n) => n.id === edge.sourceId);
      const target = nodes.find((n) => n.id === edge.targetId);
      if (!source || !target) return null;
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const len = Math.hypot(dx, dy) || 1;
      const perpX = -dy / len;
      const perpY = dx / len;
      const bulge = Math.min(80, Math.max(20, len * 0.15));
      const cx = midX + perpX * bulge;
      const cy = midY + perpY * bulge;
      const path = `M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}`;
      return (
        <path
          key={edge.id}
          d={path}
          fill="none"
          stroke={edge.dashed ? "#94a3b8" : "#cbd5e1"}
          strokeWidth={3}
          strokeDasharray={edge.dashed ? "8, 8" : "none"}
        />
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden outline-none bg-[#f8fafc]"
      style={{
        backgroundImage: "radial-gradient(#cbd5e1 1.5px, transparent 0)",
        backgroundSize: "32px 32px",
        cursor: draggingNodeId ? "grabbing" : isPanning ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onPointerDown={(e) => handlePointerDown(e)}
    >
      <div
        className="absolute top-0 left-0 w-full h-full"
        style={{
          transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <svg
          className="absolute overflow-visible pointer-events-none"
          width={canvasSize}
          height={canvasSize}
          style={{ zIndex: 0 }}
        >
          {renderEdges()}
        </svg>
        <div className="absolute top-0 left-0 w-full h-full" style={{ zIndex: 10 }}>
          {nodes.map((node) => (
            <div
              key={node.id}
              onPointerDown={(e) => handlePointerDown(e, node.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onNodeOpenEditor(node.id);
              }}
              style={{
                position: "absolute",
                transform: `translate(${node.x}px, ${node.y}px)`,
                marginLeft: getNodeOffsetX(node.type),
                marginTop: -50,
                cursor: "grab",
                padding: "8px",
                margin: "-8px",
                minWidth: "44px",
                minHeight: "44px",
              }}
            >
              {renderNode(node, {
                isDragging: draggingNodeId === node.id,
                isSelected: selectedNodeId === node.id,
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getNodeOffsetX(type: string): number {
  switch (type) {
    case "core":
      return -144;
    case "category":
      return -128;
    default:
      return -112;
  }
}
