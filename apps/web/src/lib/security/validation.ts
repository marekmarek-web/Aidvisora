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

// FCM registration tokens (both iOS + Android) are ~140–250 chars of
// `[A-Za-z0-9:_-]`. We deliberately keep min low (32) and max high (4096)
// to avoid rejecting legacy APNs-hex rows still in transit during the
// 2026-04-23 FCM unification rollout. Format is validated structurally,
// not by length.
const PUSH_TOKEN_REGEX = /^[A-Za-z0-9:_\-.]+$/;

export const pushDeviceBodySchema = z.object({
  pushToken: z
    .string()
    .trim()
    .min(32)
    .max(4096)
    .regex(PUSH_TOKEN_REGEX, "push token contains invalid characters"),
  platform: z.enum(["ios", "android"]),
  deviceName: z.string().trim().max(120).optional(),
  appVersion: z.string().trim().max(40).optional(),
});

export const revokePushDeviceBodySchema = z.object({
  pushToken: z
    .string()
    .trim()
    .min(32)
    .max(4096)
    .regex(PUSH_TOKEN_REGEX, "push token contains invalid characters"),
});
