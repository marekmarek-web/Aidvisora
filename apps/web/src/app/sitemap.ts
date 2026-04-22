import type { MetadataRoute } from "next";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://aidvisora.cz"
  );
}

const PUBLIC_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
  { path: "/pro-brokery", priority: 0.8, changeFrequency: "monthly" },
  { path: "/o-nas", priority: 0.6, changeFrequency: "monthly" },
  { path: "/kontakt", priority: 0.6, changeFrequency: "monthly" },
  { path: "/klientska-zona", priority: 0.7, changeFrequency: "monthly" },
  // B2.16 — `/rezervace` top-level nemá page (pouze `/rezervace/[token]` pro
  // tokenové booking linky). Záznam v sitemap vedl k 404 u crawlerů. Až budeme
  // chtít veřejnou landing pro rezervace, přidat `rezervace/page.tsx` a
  // záznam sem zpět.
  { path: "/bezpecnost", priority: 0.6, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/cookies", priority: 0.3, changeFrequency: "yearly" },
  { path: "/subprocessors", priority: 0.3, changeFrequency: "yearly" },
  { path: "/beta-terms", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((r) => ({
    url: `${base}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
