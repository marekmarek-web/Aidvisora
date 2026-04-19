"use client";

import { useState, useCallback } from "react";
import type { MindmapNode, MindmapEdge, ViewportState } from "./types";

export function useMindmapState(initial: {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  viewport: ViewportState;
}) {
  const [nodes, setNodes] = useState<MindmapNode[]>(initial.nodes);
  const [edges, setEdges] = useState<MindmapEdge[]>(initial.edges);
  const [viewport, setViewport] = useState<ViewportState>(initial.viewport);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const updateNodePosition = useCallback((id: string, x: number, y: number) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, x, y } : n))
    );
    setDirty(true);
  }, []);

  const updateViewport = useCallback((v: Partial<ViewportState> | ((prev: ViewportState) => ViewportState)) => {
    setViewport((prev) => (typeof v === "function" ? v(prev) : { ...prev, ...v }));
    setDirty(true);
  }, []);

  const addNode = useCallback(
    (node: Omit<MindmapNode, "id"> & { id?: string }, parentId: string) => {
      const id = node.id ?? crypto.randomUUID();
      const parent = nodes.find((n) => n.id === parentId);

      let newX = node.x ?? 400;
      let newY = node.y ?? 350;
      if (parent) {
        // Počet existujících dětí – rozložíme kolem rodiče radiálně (dokola),
        // aby „+“ zvládlo i 6+ větví bez toho, aby se uzly překrývaly.
        const childCount = edges.filter((e) => e.sourceId === parentId).length;
        const angleStep = (2 * Math.PI) / Math.max(6, childCount + 1);
        const angle = childCount * angleStep - Math.PI / 2;
        const radius = parent.type === "core" ? 320 : 260;
        newX = Math.round(parent.x + Math.cos(angle) * radius);
        newY = Math.round(parent.y + Math.sin(angle) * radius);
      }

      const newNode: MindmapNode = {
        ...node,
        id,
        x: newX,
        y: newY,
      };
      setNodes((prev) => [...prev, newNode]);
      setEdges((prev) => [...prev, { id: crypto.randomUUID(), sourceId: parentId, targetId: id, dashed: false }]);
      setDirty(true);
      return id;
    },
    [nodes, edges]
  );

  const updateNode = useCallback((id: string, data: Partial<MindmapNode>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...data } : n))
    );
    setDirty(true);
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.sourceId !== id && e.targetId !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
    setDirty(true);
  }, [selectedNodeId]);

  const addEdge = useCallback((sourceId: string, targetId: string, dashed = false) => {
    setEdges((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sourceId, targetId, dashed },
    ]);
    setDirty(true);
  }, []);

  const setState = useCallback(
    (state: { nodes: MindmapNode[]; edges: MindmapEdge[]; viewport: ViewportState }) => {
      setNodes(state.nodes);
      setEdges(state.edges);
      setViewport(state.viewport);
      setDirty(false);
    },
    []
  );

  return {
    nodes,
    edges,
    viewport,
    selectedNodeId,
    dirty,
    setNodes,
    setEdges,
    setViewport,
    setSelectedNodeId,
    setDirty,
    setState,
    updateNodePosition,
    updateViewport,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
  };
}
