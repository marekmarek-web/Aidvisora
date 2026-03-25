"use client";

import { useEffect, useMemo, useState } from "react";
import { getQuickActionsConfig } from "@/app/actions/preferences";
import {
  QUICK_ACTIONS_CATALOG,
  DEFAULT_QUICK_ACTIONS_ORDER,
  getDefaultQuickActionsConfig,
  type QuickActionId,
  type QuickActionItem,
} from "@/lib/quick-actions";

export function useQuickActionsItems(): { items: QuickActionItem[]; ready: boolean } {
  const [order, setOrder] = useState<QuickActionId[]>(DEFAULT_QUICK_ACTIONS_ORDER);
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const { visible: v } = getDefaultQuickActionsConfig();
    return v;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getQuickActionsConfig().then((c) => {
      const catalogIds = QUICK_ACTIONS_CATALOG.map((a) => a.id);
      const orderIds = c.order.length
        ? (c.order.filter((id) => catalogIds.includes(id as QuickActionId)) as QuickActionId[])
        : [...catalogIds];
      const missing = catalogIds.filter((id) => !orderIds.includes(id));
      setOrder([...orderIds, ...missing]);
      setVisible(
        catalogIds.reduce<Record<string, boolean>>((acc, id) => {
          acc[id] = c.visible[id] !== false;
          return acc;
        }, {})
      );
      setReady(true);
    });
  }, []);

  const items = useMemo(
    () =>
      order
        .filter((id) => visible[id])
        .map((id) => QUICK_ACTIONS_CATALOG.find((a) => a.id === id))
        .filter(Boolean) as QuickActionItem[],
    [order, visible]
  );

  return { items, ready };
}
