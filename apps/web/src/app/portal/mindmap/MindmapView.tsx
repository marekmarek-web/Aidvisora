"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { Download, Sparkles, Info } from "lucide-react";
import { saveMindmap } from "@/app/actions/mindmap";
import type { MindmapState } from "@/app/actions/mindmap";
import type { MindmapInteractionMode, MindmapNode, MindmapNodeClipboardData } from "./types";
import { useMindmapState } from "./useMindmapState";
import { MindmapCanvas } from "./MindmapCanvas";
import { MindmapToolbar } from "./MindmapToolbar";
import { MindmapControls } from "./MindmapControls";
import { MindmapSidePanel } from "./MindmapSidePanel";
import clsx from "clsx";
import { portalPrimaryButtonClassName } from "@/lib/ui/create-action-button-styles";
import { renderNodeByType, type NodeItemMenuAction } from "./NodeRenderers";

type MindmapViewProps = {
  initial: MindmapState;
};

export function MindmapView({ initial }: MindmapViewProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasExportRef = useRef<HTMLDivElement>(null);
  const {
    nodes,
    edges,
    viewport,
    selectedNodeId,
    dirty,
    updateNodePosition,
    updateViewport,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    setSelectedNodeId,
    setDirty,
  } = useMindmapState({
    nodes: initial.nodes,
    edges: initial.edges,
    viewport: initial.viewport,
  });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [infoPopoverOpen, setInfoPopoverOpen] = useState(false);
  const [nodeClipboard, setNodeClipboard] = useState<MindmapNodeClipboardData | null>(null);
  const [interactionMode, setInteractionMode] = useState<MindmapInteractionMode>("select");
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  /** Side panel only after double-tap / double-click / menu „Upravit“ / chip Upravit (not single tap). */
  const [sidePanelNodeId, setSidePanelNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (interactionMode !== "connect") setConnectSourceId(null);
  }, [interactionMode]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await saveMindmap(initial.entityType, initial.entityId, {
        viewport,
        nodes,
        edges,
      });
      setDirty(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Uložení selhalo.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }, [initial.entityType, initial.entityId, viewport, nodes, edges, setDirty]);

  const handleAddNode = useCallback(
    (parentId: string, type: "category" | "item" | "goal") => {
      addNode(
        {
          type,
          title: type === "category" ? "Nová kategorie" : type === "goal" ? "Nový cíl" : "Nová položka",
          subtitle: null,
          x: 0,
          y: 0,
          entityType: null,
          entityId: null,
          metadata: type === "goal" ? { value: "0 Kč", progress: 0 } : type === "item" ? { value: "0 Kč", status: "planned" } : null,
        },
        parentId
      );
    },
    [addNode]
  );

  const handleCenter = useCallback(() => {
    const root = nodes.find((n) => n.type === "core");
    if (!root || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    updateViewport({
      pan: {
        x: cx - root.x * viewport.zoom,
        y: cy - root.y * viewport.zoom,
      },
      zoom: 1,
    });
  }, [nodes, viewport.zoom, updateViewport]);

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;
  const sidePanelNode = sidePanelNodeId ? nodes.find((n) => n.id === sidePanelNodeId) ?? null : null;

  const handleCopyNodeData = useCallback(() => {
    if (!selectedNode) return;
    setNodeClipboard({
      title: selectedNode.title,
      subtitle: selectedNode.subtitle,
      type: selectedNode.type,
      metadata: selectedNode.metadata ? { ...selectedNode.metadata } : null,
    });
  }, [selectedNode]);

  const handlePasteNodeData = useCallback(() => {
    if (!selectedNode || !nodeClipboard || selectedNode.type === "core") return;
    const meta = nodeClipboard.metadata ? { ...nodeClipboard.metadata } : null;
    updateNode(selectedNode.id, {
      title: nodeClipboard.title,
      subtitle: nodeClipboard.subtitle,
      type: nodeClipboard.type,
      metadata: meta && Object.keys(meta).length ? meta : null,
    });
  }, [selectedNode, nodeClipboard, updateNode]);

  const findParentId = useCallback(
    (nodeId: string) => {
      const e = edges.find((ed) => ed.targetId === nodeId);
      if (e) return e.sourceId;
      return nodes.find((n) => n.type === "core")?.id ?? null;
    },
    [edges, nodes]
  );

  const handleNodeTap = useCallback(
    (id: string) => {
      if (interactionMode === "connect") {
        if (!connectSourceId) {
          setConnectSourceId(id);
          return;
        }
        if (connectSourceId === id) {
          setConnectSourceId(null);
          return;
        }
        addEdge(connectSourceId, id);
        setConnectSourceId(null);
        setInteractionMode("select");
        setSelectedNodeId(null);
        setSidePanelNodeId(null);
        return;
      }
      setSelectedNodeId(id);
      setSidePanelNodeId(null);
    },
    [interactionMode, connectSourceId, addEdge, setSelectedNodeId]
  );

  const handleNodeOpenEditor = useCallback(
    (id: string) => {
      if (interactionMode === "connect") return;
      setSelectedNodeId(id);
      setSidePanelNodeId(id);
    },
    [interactionMode, setSelectedNodeId]
  );

  const handleCanvasBackgroundClick = useCallback(() => {
    setSelectedNodeId(null);
    setSidePanelNodeId(null);
    if (interactionMode === "connect") setConnectSourceId(null);
  }, [interactionMode, setSelectedNodeId]);

  const handleItemMenu = useCallback(
    (node: MindmapNode, action: NodeItemMenuAction) => {
      if (action === "edit") {
        setSelectedNodeId(node.id);
        setSidePanelNodeId(node.id);
        return;
      }
      if (action === "delete") {
        if (node.type === "core") {
          window.alert("Kořenový uzel nelze smazat.");
          return;
        }
        if (!window.confirm("Opravdu smazat tento uzel?")) return;
        deleteNode(node.id);
        setSelectedNodeId((s) => (s === node.id ? null : s));
        setSidePanelNodeId((s) => (s === node.id ? null : s));
        return;
      }
      if (action === "duplicate") {
        if (node.type === "core") return;
        const parentId = findParentId(node.id);
        if (!parentId) return;
        addNode(
          {
            type: node.type,
            title: `${node.title} (kopie)`,
            subtitle: node.subtitle,
            x: node.x,
            y: node.y,
            entityType: null,
            entityId: null,
            metadata: node.metadata ? { ...node.metadata } : null,
          },
          parentId
        );
      }
    },
    [addNode, deleteNode, findParentId, setSelectedNodeId, setSidePanelNodeId]
  );

  const handleExportPng = useCallback(async () => {
    const el = canvasExportRef.current;
    if (!el) return;
    setExportBusy(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { cacheBust: true, pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      const safe = (initial.entityName ?? "export").replace(/\s+/g, "_").replace(/[^\w.-]/g, "");
      a.download = `mindmap-${safe}.png`;
      a.click();
    } catch {
      window.alert("Export se nepodařil. Zkuste jiný prohlížeč nebo menší mapu.");
    } finally {
      setExportBusy(false);
      setMobileMenuOpen(false);
    }
  }, [initial.entityName]);

  const handleAiStrategyStub = useCallback(() => {
    window.alert("Funkce AI návrhu strategie bude brzy k dispozici. Zatím použijte asistenta v portálu.");
    setMobileMenuOpen(false);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] text-[color:var(--wp-text)] overflow-hidden pb-[env(safe-area-inset-bottom)]">
      <header className="bg-[color:var(--wp-surface-card)]/90 backdrop-blur-md border-b border-[color:var(--wp-surface-card-border)] px-4 md:px-6 py-3 z-50 flex items-center justify-between gap-2 shadow-sm shrink-0">
        <div className="flex items-center gap-2 md:gap-6 min-w-0">
          {initial.entityType === "standalone" && (
            <Link
              href="/portal/mindmap"
              className="text-[color:var(--wp-text-secondary)] hover:text-[color:var(--wp-text)] text-sm font-medium shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center md:min-h-0 md:min-w-0 md:flex-initial"
            >
              ← <span className="hidden sm:inline">Výběr map</span>
            </Link>
          )}
          <div className="h-4 w-px bg-[color:var(--wp-surface-card-border)] hidden md:block" />
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-bold text-[color:var(--wp-text)] truncate text-base md:text-lg">
              {initial.entityType === "standalone" ? initial.entityName : `Mapování: ${initial.entityName}`}
            </h1>
            <span
              className={`shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border ${
                dirty ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-600 border-emerald-100"
              }`}
            >
              {dirty ? "Neuloženo" : "Uloženo"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {saveError && (
            <span className="text-rose-600 text-xs md:text-sm truncate max-w-[120px] md:max-w-none" title={saveError}>
              {saveError}
            </span>
          )}
          {!isMobile && dirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={clsx(portalPrimaryButtonClassName, "px-4 py-2 text-xs disabled:opacity-50")}
            >
              {saving ? "Ukládám…" : "Uložit"}
            </button>
          )}
          {!isMobile && (
            <>
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border border-amber-200 hover:shadow-md rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
              >
                <Sparkles size={14} className="text-amber-600" /> AI Návrh strategie
              </button>
              <button
                type="button"
                className="w-9 h-9 rounded-xl border border-[color:var(--wp-surface-card-border)] flex items-center justify-center text-[color:var(--wp-text-secondary)] hover:bg-[color:var(--wp-surface-muted)] transition-colors"
                title="Export"
              >
                <Download size={16} />
              </button>
            </>
          )}
          {isMobile && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="min-w-[44px] min-h-[44px] rounded-xl border border-[color:var(--wp-surface-card-border)] flex items-center justify-center text-[color:var(--wp-text-secondary)] hover:bg-[color:var(--wp-surface-muted)]"
                aria-label="Menu"
              >
                <span className="text-lg font-bold">⋯</span>
              </button>
              {mobileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-1 py-2 min-w-[200px] bg-[color:var(--wp-surface-card)] rounded-xl shadow-xl border border-[color:var(--wp-surface-card-border)] z-50">
                    {dirty && (
                      <button
                        type="button"
                        onClick={() => { handleSave(); setMobileMenuOpen(false); }}
                        disabled={saving}
                        className={clsx(portalPrimaryButtonClassName, "mx-2 mb-1 w-[calc(100%-1rem)] justify-center px-4 py-3 text-sm disabled:opacity-50")}
                      >
                        {saving ? "Ukládám…" : "Uložit"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAiStrategyStub}
                      className="w-full text-left px-4 py-3 text-sm font-medium text-[color:var(--wp-text-secondary)] flex items-center gap-2 min-h-[44px] active:bg-[color:var(--wp-surface-muted)]"
                    >
                      <Sparkles size={16} className="text-amber-600" /> AI Návrh strategie
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleExportPng()}
                      disabled={exportBusy}
                      className="w-full text-left px-4 py-3 text-sm font-medium text-[color:var(--wp-text-secondary)] flex items-center gap-2 min-h-[44px] disabled:opacity-50 active:bg-[color:var(--wp-surface-muted)]"
                    >
                      <Download size={16} /> {exportBusy ? "Export…" : "Export"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div ref={canvasContainerRef} className="flex-1 flex min-h-0 relative">
        <div ref={canvasExportRef} className="flex-1 min-w-0 relative flex flex-col bg-[#f8fafc]">
          {connectSourceId ? (
            <div className={clsx(portalPrimaryButtonClassName, "pointer-events-none absolute top-3 left-1/2 z-[55] max-w-[90vw] -translate-x-1/2 px-3 py-2 text-xs shadow-lg")}>
              Vyberte cílový uzel pro spojení…
            </div>
          ) : null}
          {!sidePanelNode && (
            <div className="absolute top-3 right-3 z-10 md:top-4 md:right-4">
              <button
                type="button"
                onClick={() => setInfoPopoverOpen((o) => !o)}
                className="w-9 h-9 rounded-full border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)]/90 backdrop-blur flex items-center justify-center text-[color:var(--wp-text-secondary)] hover:bg-[color:var(--wp-surface-muted)] hover:text-[color:var(--wp-text-secondary)] shadow-sm min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:w-8 md:h-8"
                aria-label="Nápověda"
              >
                <Info size={18} />
              </button>
              {infoPopoverOpen && (
                <>
                  <div className="fixed inset-0 z-40" aria-hidden onClick={() => setInfoPopoverOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-72 p-4 bg-[color:var(--wp-surface-card)] rounded-xl shadow-xl border border-[color:var(--wp-surface-card-border)] z-50 text-left text-sm text-[color:var(--wp-text-secondary)]">
                    <p>
                      Klepnutím vyberete uzel, tažením ho přesunete. Dvojité klepnutí nebo tlačítko Upravit otevře detail. Režim
                      spojení: nástroj vlevo, pak dva uzly.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          <MindmapCanvas
            nodes={nodes}
            edges={edges}
            viewport={viewport}
            selectedNodeId={selectedNodeId}
            onViewportChange={updateViewport}
            onNodePositionChange={updateNodePosition}
            onNodeTap={handleNodeTap}
            onNodeOpenEditor={handleNodeOpenEditor}
            onCanvasClick={handleCanvasBackgroundClick}
            renderNode={(node, opts) =>
              renderNodeByType(node, {
                ...opts,
                onAddChild: handleAddNode,
                onItemMenu: handleItemMenu,
              })
            }
          />
          {isMobile && selectedNode && !sidePanelNodeId && interactionMode === "select" ? (
            <div className="fixed bottom-[max(5.5rem,env(safe-area-inset-bottom,0)+4.5rem)] left-1/2 -translate-x-1/2 z-[56] pointer-events-auto">
              <button
                type="button"
                onClick={() => setSidePanelNodeId(selectedNode.id)}
                className={clsx(portalPrimaryButtonClassName, "min-h-[48px] rounded-2xl px-6 text-sm font-black shadow-lg")}
              >
                Upravit uzel
              </button>
            </div>
          ) : null}
          <MindmapToolbar
            mode={interactionMode}
            onModeChange={setInteractionMode}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <MindmapControls
            viewport={viewport}
            onZoom={(delta) =>
              updateViewport({ zoom: Math.min(Math.max(viewport.zoom + delta, 0.4), 2) })
            }
            onCenter={handleCenter}
            mobile={isMobile}
          />

          {settingsOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[60] bg-black/30"
                aria-label="Zavřít nastavení"
                onClick={() => setSettingsOpen(false)}
              />
              <div className="fixed left-4 bottom-24 md:left-24 md:bottom-auto md:top-28 z-[61] w-[min(calc(100vw-2rem),280px)] rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-4 shadow-xl">
                <p className="text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)] mb-2">Mapa</p>
                <p className="text-sm font-bold text-[color:var(--wp-text)] mb-3 truncate" title={initial.entityName}>
                  {initial.entityName}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleCenter();
                      setSettingsOpen(false);
                    }}
                    className={clsx(portalPrimaryButtonClassName, "text-sm")}
                  >
                    Vycentrovat mapu
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="min-h-[44px] rounded-xl border border-[color:var(--wp-surface-card-border)] text-[color:var(--wp-text-secondary)] text-sm font-bold active:scale-[0.98]"
                  >
                    Zavřít
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
        {sidePanelNode && (
        <div className="fixed inset-0 z-50 md:relative md:inset-auto md:z-auto md:w-80 md:shrink-0 flex flex-col">
          <MindmapSidePanel
            key={sidePanelNode.id}
            node={sidePanelNode}
            entityType={initial.entityType}
            entityId={initial.entityId}
            onClose={() => setSidePanelNodeId(null)}
            onUpdateNode={updateNode}
            onDeleteNode={(id) => {
              deleteNode(id);
              setSelectedNodeId(null);
              setSidePanelNodeId(null);
            }}
            fullscreenOnMobile={!!sidePanelNode}
            onCopyNodeData={handleCopyNodeData}
            onPasteNodeData={handlePasteNodeData}
            hasClipboard={nodeClipboard != null}
          />
        </div>
        )}
      </div>
    </div>
  );
}
