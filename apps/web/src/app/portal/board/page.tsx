import dynamic from "next/dynamic";
import { getOrCreateBoardView } from "@/app/actions/board";
import { resolveBoardColumns } from "@/app/board/resolve-board-columns";
import type { Board, Column, Group, Item } from "@/app/components/monday/types";

const PortalBoardView = dynamic(
  () => import("../PortalBoardView").then((m) => m.PortalBoardView),
  {
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-8 text-[color:var(--wp-text-secondary)] text-sm">Načítání boardu…</div>
    ),
  },
);

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ viewId?: string }>;
}) {
  const { viewId: viewIdParam } = await searchParams;
  let dbViewId: string | undefined;
  let initialBoard: Board | undefined;

  try {
    const data = await getOrCreateBoardView(viewIdParam ?? null);
    dbViewId = data.view.id;

    const savedColumns: Column[] = (data.view.columnsConfig as Column[]) ?? [];
    const columns = resolveBoardColumns(savedColumns);
    const groupConfigs = (data.view.groupsConfig ?? []) as Array<{
      id: string;
      name: string;
      color: string;
      collapsed: boolean;
      subtitle?: string;
    }>;

    const items: Record<string, Item> = {};
    for (const item of data.items) {
      items[item.id] = {
        id: item.id,
        name: item.name,
        cells: item.cells,
        contactId: item.contactId ?? undefined,
        contactName: item.contactName ?? undefined,
      };
    }

    const groups: Group[] = groupConfigs.map((gc) => ({
      ...gc,
      subtitle: gc.subtitle,
      itemIds: data.items
        .filter((i) => i.groupId === gc.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((i) => i.id),
    }));

    const orphanItems = data.items.filter(
      (i) => !groupConfigs.some((g) => g.id === i.groupId)
    );
    if (orphanItems.length > 0 && groups.length > 0) {
      groups[0].itemIds.push(...orphanItems.map((i) => i.id));
    }

    // View id musí být stejné jako board_views.id — jinak BoardHeader/dbViewId nespáruje aktivní view se sloupci (bylo v1 vs UUID → prázdná tabulka).
    initialBoard = {
      id: data.view.id,
      name: data.view.name,
      views: [{ id: data.view.id, name: data.view.name, columns }],
      groups,
      items,
    };
  } catch {
    // DB not available - fall back to seed/localStorage
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <PortalBoardView dbViewId={dbViewId} initialBoard={initialBoard} />
    </div>
  );
}
