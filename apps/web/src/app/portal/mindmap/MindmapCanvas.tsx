"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { MindmapNode, MindmapEdge, ViewportState } from "./types";

function getCanvasSize() {
  if (typeof window === "undefined") return 5000;
  return window.innerWidth < 768 ? 3000 : 5000;
}

type MindmapCanvasProps = {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  viewport: ViewportState;
  selectedNodeId: string | null;
  onViewportChange: (v: Partial<ViewportState>) => void;
  onNodePositionChange: (id: string, x: number, y: number) => void;
  onNodeSelect: (id: string | null) => void;
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
  onNodeSelect,
  onCanvasClick,
  renderNode,
}: MindmapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef<{ dist: number; zoom: number; midX: number; midY: number } | null>(null);
  const [canvasSize] = useState(getCanvasSize);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, nodeId?: string) => {
      if (e.button !== 0) return;
      if (nodeId) {
        e.stopPropagation();
        setDraggingNodeId(nodeId);
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          startPosRef.current = {
            x: (e.clientX - viewport.pan.x) / viewport.zoom - node.x,
            y: (e.clientY - viewport.pan.y) / viewport.zoom - node.y,
          };
        }
        onNodeSelect(nodeId);
      } else {
        setIsPanning(true);
        startPosRef.current = { x: e.clientX - viewport.pan.x, y: e.clientY - viewport.pan.y };
        onCanvasClick();
      }
    },
    [nodes, viewport, onNodeSelect, onCanvasClick]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
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

  const handlePointerUp = useCallback(() => {
    setDraggingNodeId(null);
    setIsPanning(false);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => handlePointerMove(e as unknown as React.PointerEvent);
    const onUp = () => handlePointerUp();
    if (draggingNodeId || isPanning) {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
    }
  }, [draggingNodeId, isPanning, handlePointerMove, handlePointerUp]);

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
      const offset = Math.abs(target.x - source.x) / 2;
      const path = `M ${source.x} ${source.y} C ${source.x + offset} ${source.y}, ${target.x - offset} ${target.y}, ${target.x} ${target.y}`;
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
