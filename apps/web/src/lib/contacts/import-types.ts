export type ContactRowInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  lifecycleStage?: string | null;
  tags?: string[] | null;
  notes?: string | null;
};

export type ColumnMapping = {
  firstName: number;
  lastName: number;
  email: number;
  phone: number;
  lifecycleStage: number | null;
  tags: number | null;
  notes: number | null;
};

/** Výchozí mapování při prvním sloupci = jméno atd.; volitelná pole neimportovat. */
export const DEFAULT_CONTACT_IMPORT_MAPPING: ColumnMapping = {
  firstName: 0,
  lastName: 1,
  email: 2,
  phone: 3,
  lifecycleStage: null,
  tags: null,
  notes: null,
};
