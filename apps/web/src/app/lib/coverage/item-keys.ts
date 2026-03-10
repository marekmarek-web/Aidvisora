import {
  COVERAGE_CATEGORIES,
  type CoverageCategory,
  type SegmentItem,
} from "@/app/lib/segment-hierarchy";

export type CoverageItemKey = { itemKey: string; segmentCode: string; category: string; label: string };

/** Vrací stabilní klíč položky (soulad s ProductCoverageGrid cellKey). */
export function cellKey(cat: CoverageCategory, item?: SegmentItem): string {
  if (cat.type === "single") return cat.category;
  return item ? `${cat.category}:${item.label}` : cat.category;
}

/** Všechny položky coverage jako flat seznam s itemKey, segmentCode, category, label. */
export function getAllCoverageItemKeys(): CoverageItemKey[] {
  const out: CoverageItemKey[] = [];
  for (const cat of COVERAGE_CATEGORIES) {
    if (cat.type === "single") {
      out.push({
        itemKey: cellKey(cat),
        segmentCode: cat.item.code,
        category: cat.category,
        label: cat.item.label,
      });
    } else {
      for (const item of cat.items) {
        out.push({
          itemKey: cellKey(cat, item),
          segmentCode: item.code,
          category: cat.category,
          label: item.label,
        });
      }
    }
  }
  return out;
}

/** Pro daný itemKey vrátí segmentCode, category, label (nebo null pokud neznámý). */
export function getItemInfo(itemKey: string): CoverageItemKey | null {
  const all = getAllCoverageItemKeys();
  return all.find((x) => x.itemKey === itemKey) ?? null;
}

export function getItemSegmentCode(itemKey: string): string | null {
  return getItemInfo(itemKey)?.segmentCode ?? null;
}

export function getItemCategory(itemKey: string): string | null {
  return getItemInfo(itemKey)?.category ?? null;
}

export function getItemLabel(itemKey: string): string | null {
  return getItemInfo(itemKey)?.label ?? null;
}
