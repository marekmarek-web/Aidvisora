/** Centralizované klíče pro TanStack Query – konzistentní invalidace napříč obrazovkami. */
export const queryKeys = {
  contacts: {
    all: ["contacts"] as const,
    list: () => [...queryKeys.contacts.all, "list"] as const,
    /** Dokumenty + smlouvy u kontaktu (DocumentsSection). */
    documentsBundle: (contactId: string) => [...queryKeys.contacts.all, "documentsBundle", contactId] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: () => [...queryKeys.tasks.all, "list"] as const,
    counts: () => [...queryKeys.tasks.all, "counts"] as const,
    /** Seznam úkolů podle filtru (stejná data jako dříve `reload` v tasks page). */
    board: (filter: string) => [...queryKeys.tasks.all, "board", filter] as const,
  },
  pipeline: {
    all: ["pipeline"] as const,
    board: () => ["pipeline", "board"] as const,
    openForSelect: ["pipeline", "openForSelect"] as const,
  },
} as const;
