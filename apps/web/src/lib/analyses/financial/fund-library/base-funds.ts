import type { BaseFund } from "./types";
import { BATCH_A_BASE_FUNDS } from "./base-funds-batch-a";

/**
 * Katalog base fondů: Batch A (reálná data) + placeholdery pro zbývající klíče v1.
 */
const BASE_FUNDS_PLACEHOLDERS: readonly BaseFund[] = [
  {
    baseFundKey: "fidelity_target_2040",
    displayName: "Fidelity Target 2040",
    provider: "Fidelity International",
    category: "Smíšený (lifecycle)",
    isActive: true,
    sources: [
      { kind: "internal", label: "Factsheet (doplnit)" },
      { kind: "factsheet", label: "Výrobce (doplnit URL)" },
    ],
    assets: { logoPath: "/logos/fidelity.png" },
    notes: ["Legacy productKey: fidelity2040"],
    performance: null,
  },
  {
    baseFundKey: "investika_realitni_fond",
    displayName: "Investika realitní fond",
    provider: "Investika",
    category: "Nemovitostní",
    isActive: true,
    sources: [{ kind: "internal", label: "Factsheet (doplnit)" }],
    assets: {},
    performance: null,
  },
  {
    baseFundKey: "monetika",
    displayName: "Monetika",
    provider: "—",
    category: "Dluhopisy / hotovost (placeholder)",
    isActive: true,
    sources: [{ kind: "internal", label: "Specifikace produktu (doplnit)" }],
    assets: {},
    performance: null,
  },
  {
    baseFundKey: "efektika",
    displayName: "Efektika",
    provider: "—",
    category: "Smíšené (placeholder)",
    isActive: true,
    sources: [{ kind: "internal", label: "Specifikace produktu (doplnit)" }],
    assets: {},
    performance: null,
  },
  {
    baseFundKey: "conseq_globalni_akciovy_ucastnicky",
    displayName: "Conseq Globální akciový účastnický",
    provider: "Conseq IM",
    category: "Účastnický fond (DPS)",
    isActive: true,
    sources: [
      { kind: "internal", label: "Factsheet (doplnit)" },
      { kind: "factsheet", label: "Conseq (doplnit URL)" },
    ],
    assets: { logoPath: "/logos/conseq.png" },
    notes: ["Legacy productKey: conseq. Varianty DIP/ZAL viz fund-variants."],
    performance: null,
  },
  {
    baseFundKey: "nn_povinny_konzervativni",
    displayName: "NN povinný konzervativní",
    provider: "NN",
    category: "Účastnický fond (DPS)",
    isActive: true,
    sources: [{ kind: "internal", label: "Factsheet NN (doplnit)" }],
    assets: {},
    performance: null,
  },
  {
    baseFundKey: "nn_vyvazeny",
    displayName: "NN vyvážený",
    provider: "NN",
    category: "Účastnický fond (DPS)",
    isActive: true,
    sources: [{ kind: "internal", label: "Factsheet NN (doplnit)" }],
    assets: {},
    performance: null,
  },
  {
    baseFundKey: "nn_rustovy",
    displayName: "NN růstový",
    provider: "NN",
    category: "Účastnický fond (DPS)",
    isActive: true,
    sources: [{ kind: "internal", label: "Factsheet NN (doplnit)" }],
    assets: {},
    performance: null,
  },
  {
    baseFundKey: "creif",
    displayName: "CREIF",
    provider: "CAIAC Fund Management AG",
    category: "Nemovitostní",
    isActive: true,
    sources: [
      { kind: "internal", label: "Factsheet (doplnit)" },
      { kind: "factsheet", label: "EFEKTA / CREIF (doplnit URL)" },
    ],
    assets: {
      logoPath: "/logos/creif.png",
      heroPath: "/report-assets/creif/creif-816.jpg",
      galleryPaths: [
        "/report-assets/creif/creif-818.jpg",
        "/report-assets/creif/creif-853.jpg",
        "/report-assets/creif/creif-813.jpg",
      ],
    },
    performance: null,
  },
  {
    baseFundKey: "atris",
    displayName: "ATRIS (Realita)",
    provider: "ATRIS investiční společnost",
    category: "Nemovitostní",
    isActive: true,
    sources: [
      { kind: "internal", label: "Factsheet (doplnit)" },
      { kind: "factsheet", label: "ATRIS (doplnit URL)" },
    ],
    assets: {
      logoPath: "/logos/atris.png",
      heroPath: "/report-assets/atris/atris1.jpg",
      galleryPaths: [
        "/report-assets/atris/atris2.jpg",
        "/report-assets/atris/atris3.jpg",
        "/report-assets/atris/atris4.jpg",
      ],
    },
    performance: null,
  },
  {
    baseFundKey: "penta",
    displayName: "Penta Investments",
    provider: "Penta Investments",
    category: "Privátní kapitál",
    isActive: true,
    sources: [
      { kind: "internal", label: "Factsheet (doplnit)" },
      { kind: "factsheet", label: "Penta (doplnit URL)" },
    ],
    assets: {
      logoPath: "/logos/Penta.png",
      galleryPaths: [
        "/report-assets/penta/penta1.png",
        "/report-assets/penta/penta2.jpg",
        "/report-assets/penta/penta3.webp",
      ],
    },
    performance: null,
  },
];

export const BASE_FUNDS: readonly BaseFund[] = [...BATCH_A_BASE_FUNDS, ...BASE_FUNDS_PLACEHOLDERS];
