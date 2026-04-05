import { DEFAULT_FUND_AVAILABILITY, type BaseFund } from "./types";
import { BATCH_A_BASE_FUNDS } from "./base-funds-batch-a";
import { BATCH_B_BASE_FUNDS } from "./base-funds-batch-b";
import { BATCH_C_BASE_FUNDS } from "./base-funds-batch-c";

type BaseFundInput = Omit<BaseFund, "availability">;

/**
 * Katalog base fondů: Batch A + B + C (reálná data) + placeholdery pro zbývající klíče v1.
 */
const BASE_FUNDS_PLACEHOLDERS_RAW: readonly BaseFundInput[] = [
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

const BASE_FUNDS_PLACEHOLDERS: readonly BaseFund[] = BASE_FUNDS_PLACEHOLDERS_RAW.map((f) => ({
  ...f,
  availability: DEFAULT_FUND_AVAILABILITY,
}));

export const BASE_FUNDS: readonly BaseFund[] = [
  ...BATCH_A_BASE_FUNDS,
  ...BATCH_B_BASE_FUNDS,
  ...BATCH_C_BASE_FUNDS,
  ...BASE_FUNDS_PLACEHOLDERS,
];
