/**
 * Rodinné role pro členy domácnosti (household_members.role).
 *
 * Historie: dříve se používalo "primary" / "member" / "child" – teď se sjednocuje
 * na konkrétní rodinnou taxonomii, která je čitelnější pro poradce i klienty.
 * SQL migrace `household_members_family_roles_*` existující data mapuje:
 *   primary → partner, member → partnerka, child → dite, jinak → jiny.
 */
export const HOUSEHOLD_ROLES = [
  { value: "otec", label: "Otec" },
  { value: "matka", label: "Matka" },
  { value: "syn", label: "Syn" },
  { value: "dcera", label: "Dcera" },
  { value: "partner", label: "Partner" },
  { value: "partnerka", label: "Partnerka" },
  { value: "dite", label: "Dítě" },
  { value: "prarodic", label: "Prarodič" },
  { value: "jiny", label: "Jiný" },
] as const;

export type HouseholdRoleValue = (typeof HOUSEHOLD_ROLES)[number]["value"];

export const HOUSEHOLD_ROLE_VALUES: readonly HouseholdRoleValue[] = HOUSEHOLD_ROLES.map(
  (r) => r.value
);

const LEGACY_ROLE_MAP: Record<string, HouseholdRoleValue> = {
  primary: "partner",
  member: "partnerka",
  child: "dite",
};

/**
 * Bezpečný label pro libovolnou hodnotu role v DB (včetně legacy zápisů).
 * Nikdy nevrací prázdný řetězec — pro `null` / neznámou hodnotu vrátí "—".
 */
export function householdRoleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  const direct = HOUSEHOLD_ROLES.find((r) => r.value === role);
  if (direct) return direct.label;
  const legacy = LEGACY_ROLE_MAP[role];
  if (legacy) {
    const mapped = HOUSEHOLD_ROLES.find((r) => r.value === legacy);
    if (mapped) return mapped.label;
  }
  return role;
}

/** Vrací `HouseholdRoleValue` pokud je input validní (přímo nebo přes legacy mapu), jinak null. */
export function normalizeHouseholdRole(role: string | null | undefined): HouseholdRoleValue | null {
  if (!role) return null;
  const trimmed = role.trim().toLowerCase();
  if (!trimmed) return null;
  if ((HOUSEHOLD_ROLE_VALUES as readonly string[]).includes(trimmed)) {
    return trimmed as HouseholdRoleValue;
  }
  return LEGACY_ROLE_MAP[trimmed] ?? null;
}

export function isHouseholdRole(role: string | null | undefined): role is HouseholdRoleValue {
  if (!role) return false;
  return (HOUSEHOLD_ROLE_VALUES as readonly string[]).includes(role);
}

/** True for dětské role včetně legacy zápisu `child`. */
export function isHouseholdChildLikeRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return r === "child" || r === "dite" || r === "syn" || r === "dcera";
}
