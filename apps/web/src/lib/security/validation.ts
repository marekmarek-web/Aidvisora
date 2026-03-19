import { z } from "zod";

const UUID_SCHEMA = z.string().uuid();

export function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_SCHEMA.safeParse(value).success;
}

export function toTrimmedString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function sanitizeStorageSegment(value: string | null | undefined, fallback = "misc"): string {
  if (!value) return fallback;
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);
  return sanitized || fallback;
}

export const pushDeviceBodySchema = z.object({
  pushToken: z.string().trim().min(16).max(512),
  platform: z.enum(["ios", "android"]),
  deviceName: z.string().trim().max(120).optional(),
  appVersion: z.string().trim().max(40).optional(),
});

export const revokePushDeviceBodySchema = z.object({
  pushToken: z.string().trim().min(16).max(512),
});
