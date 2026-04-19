import { NextResponse } from "next/server";
import { and, eq, userDevices } from "db";
import { withTenantContextFromAuth } from "@/lib/auth/with-auth-context";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/get-membership";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { pushDeviceBodySchema, revokePushDeviceBodySchema } from "@/lib/security/validation";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const membership = await getMembership(user.id);
  if (!membership) return null;

  return {
    userId: user.id,
    tenantId: membership.tenantId,
  };
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limiter = checkRateLimit(request, "push-devices-post", `${auth.tenantId}:${auth.userId}`, {
      windowMs: 60_000,
      maxRequests: 40,
    });
    if (!limiter.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please retry later." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
      );
    }

    const parsed = pushDeviceBodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const { pushToken, platform, deviceName, appVersion } = parsed.data;

    await withTenantContextFromAuth({ tenantId: auth.tenantId, userId: auth.userId }, (tx) =>
      tx
        .insert(userDevices)
        .values({
          tenantId: auth.tenantId,
          userId: auth.userId,
          pushToken,
          platform,
          deviceName: deviceName || null,
          appVersion: appVersion || null,
          pushEnabled: true,
          lastSeenAt: new Date(),
          revokedAt: null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userDevices.tenantId, userDevices.userId, userDevices.pushToken],
          set: {
            platform,
            deviceName: deviceName || null,
            appVersion: appVersion || null,
            pushEnabled: true,
            lastSeenAt: new Date(),
            revokedAt: null,
            updatedAt: new Date(),
          },
        }),
    );

    await logAudit({
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: "push_device_registered",
      entityType: "user_device",
      request,
      meta: { platform },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to register push device." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limiter = checkRateLimit(request, "push-devices-delete", `${auth.tenantId}:${auth.userId}`, {
      windowMs: 60_000,
      maxRequests: 40,
    });
    if (!limiter.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please retry later." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
      );
    }

    const parsed = z
      .object({
        pushToken: revokePushDeviceBodySchema.shape.pushToken.optional(),
        allDevices: z.boolean().optional(),
      })
      .safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const { pushToken, allDevices } = parsed.data;

    if (allDevices) {
      await withTenantContextFromAuth({ tenantId: auth.tenantId, userId: auth.userId }, (tx) =>
        tx
          .update(userDevices)
          .set({
            pushEnabled: false,
            revokedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(userDevices.tenantId, auth.tenantId), eq(userDevices.userId, auth.userId))),
      );

      await logAudit({
        tenantId: auth.tenantId,
        userId: auth.userId,
        action: "push_device_revoked_all",
        entityType: "user_device",
        request,
      }).catch(() => {});

      return NextResponse.json({ ok: true });
    }
    if (!pushToken) {
      return NextResponse.json({ error: "Push token is required." }, { status: 400 });
    }

    await withTenantContextFromAuth({ tenantId: auth.tenantId, userId: auth.userId }, (tx) =>
      tx
        .update(userDevices)
        .set({
          pushEnabled: false,
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(userDevices.tenantId, auth.tenantId), eq(userDevices.userId, auth.userId), eq(userDevices.pushToken, pushToken))),
    );

    await logAudit({
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: "push_device_revoked",
      entityType: "user_device",
      request,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to revoke push device." }, { status: 500 });
  }
}
