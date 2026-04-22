import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { contacts } from "./contacts";

/** E-mailová kampaň (v2 — plná platforma, viz migrace email-campaigns-v2-2026-04-22.sql). */
export const emailCampaigns = pgTable(
  "email_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").notNull(),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    /** Preheader (neviditelný náhled, který klienti vidí v inboxu). */
    preheader: text("preheader"),
    bodyHtml: text("body_html").notNull(),
    /** draft | scheduled | queued | sending | sent | failed | cancelled */
    status: text("status").notNull().default("draft"),

    /** Identifikátor preset segmentu (all | vip | investors | mortgage | custom). */
    segmentId: text("segment_id"),
    /** Strukturovaný filtr pro visual segment builder (AND/OR rules). */
    segmentFilter: jsonb("segment_filter"),

    /** Vazba na šablonu (nepovinná — umožňuje 'Uložit kampaň jako šablonu'). */
    templateId: uuid("template_id"),

    /** Plánované odeslání (scheduled send). */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    queuedAt: timestamp("queued_at", { withTimezone: true }),

    /** Override fromName pro tuto kampaň (jinak se bere z advisor_preferences / tenant_settings). */
    fromNameOverride: text("from_name_override"),
    /** Vypne open pixel + click tracking pro kampaň (např. compliance). */
    trackingEnabled: boolean("tracking_enabled").notNull().default(true),

    /** Parent pro A/B test — B varianta odkazuje na A (parent). */
    parentCampaignId: uuid("parent_campaign_id"),
    /** 'a' | 'b' | null (pouze při A/B). */
    abVariant: text("ab_variant"),
    abWinnerAt: timestamp("ab_winner_at", { withTimezone: true }),

    /** Pokud kampaň vytvořila automation, uložíme vazbu kvůli reportingu. */
    automationRuleId: uuid("automation_rule_id"),

    /** Finální počet kontaktů po resolvingu segmentu (pro progress bar). */
    recipientCount: integer("recipient_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => ({
    tenantIdx: index("email_campaigns_tenant_id_idx").on(t.tenantId),
    scheduledIdx: index("email_campaigns_scheduled_at_idx").on(t.scheduledAt),
    parentIdx: index("email_campaigns_parent_idx").on(t.parentCampaignId),
    automationIdx: index("email_campaigns_automation_rule_idx").on(t.automationRuleId),
  }),
);

export const emailCampaignRecipients = pgTable(
  "email_campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    /** pending | queued | sent | delivered | opened | clicked | bounced | complained | failed | skipped | unsubscribed */
    status: text("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    providerMessageId: text("provider_message_id"),
    /** Per-recipient token – do odkazů a open pixelu. */
    trackingToken: text("tracking_token"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    firstClickAt: timestamp("first_click_at", { withTimezone: true }),
    clickCount: integer("click_count").notNull().default(0),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    bounceType: text("bounce_type"), // 'hard' | 'soft' | 'suppressed'
    complaintAt: timestamp("complaint_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    campaignIdx: index("email_campaign_recipients_campaign_id_idx").on(t.campaignId),
    providerIdx: index("email_campaign_recipients_provider_message_idx").on(t.providerMessageId),
    contactIdx: index("email_campaign_recipients_contact_idx").on(t.tenantId, t.contactId),
    tokenUidx: uniqueIndex("email_campaign_recipients_token_uidx").on(t.trackingToken),
  }),
);

/** Šablony — globální (tenant_id NULL) + per-tenant. */
export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** blank | birthday | newsletter | consultation | year_in_review | referral_ask | custom */
    kind: text("kind").notNull(),
    category: text("category"),
    subject: text("subject").notNull(),
    preheader: text("preheader"),
    bodyHtml: text("body_html").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    mergeFields: text("merge_fields").array().notNull().default([]),
    iconName: text("icon_name"),
    accentClass: text("accent_class"),
    styleKey: text("style_key"),
    description: text("description"),
    complianceNote: text("compliance_note"),
    isArchived: boolean("is_archived").notNull().default(false),
    isSystem: boolean("is_system").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index("email_templates_tenant_idx").on(t.tenantId),
    kindIdx: index("email_templates_kind_idx").on(t.kind),
    activeIdx: index("email_templates_active_idx").on(t.tenantId, t.isArchived, t.sortOrder),
  }),
);

/** Append-only event log pro analytiku kampaní (open/click/bounce/complained/…). */
export const emailCampaignEvents = pgTable(
  "email_campaign_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").references(() => emailCampaignRecipients.id, {
      onDelete: "cascade",
    }),
    /** queued|sent|delivered|opened|clicked|bounced|complained|unsubscribed|failed */
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    url: text("url"),
    metadata: jsonb("metadata"),
  },
  (t) => ({
    campaignIdx: index("email_campaign_events_campaign_idx").on(t.campaignId, t.occurredAt),
    recipientIdx: index("email_campaign_events_recipient_idx").on(t.recipientId, t.eventType),
    tenantTypeIdx: index("email_campaign_events_tenant_type_idx").on(t.tenantId, t.eventType),
  }),
);

/** Queue pro async rozesílání (F2). */
export const emailSendQueue = pgTable(
  "email_send_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => emailCampaignRecipients.id, { onDelete: "cascade" }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).defaultNow().notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    /** pending|processing|sent|failed|cancelled */
    status: text("status").notNull().default("pending"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dueIdx: index("email_send_queue_due_idx").on(t.status, t.nextAttemptAt),
    campaignIdx: index("email_send_queue_campaign_idx").on(t.campaignId),
  }),
);

/** F4 — Automation rules. */
export const emailAutomationRules = pgTable(
  "email_automation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** birthday|service_due|contract_anniversary|proposal_accepted|contract_activated|analysis_completed|inactive_client|referral_ask_after_proposal|year_in_review */
    triggerType: text("trigger_type").notNull(),
    triggerConfig: jsonb("trigger_config").notNull().default({}),
    segmentFilter: jsonb("segment_filter"),
    templateId: uuid("template_id").references(() => emailTemplates.id, { onDelete: "set null" }),
    scheduleOffsetDays: integer("schedule_offset_days").notNull().default(0),
    sendHour: integer("send_hour").notNull().default(9),
    isActive: boolean("is_active").notNull().default(false),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastMatchedCount: integer("last_matched_count").notNull().default(0),
    stats: jsonb("stats").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index("email_automation_rules_tenant_idx").on(t.tenantId),
    activeIdx: index("email_automation_rules_active_idx").on(t.isActive, t.triggerType),
  }),
);

/** F4 — Automation runs (jeden záznam na matchnutý kontakt v daném run). */
export const emailAutomationRuns = pgTable(
  "email_automation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => emailAutomationRules.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => emailCampaigns.id, { onDelete: "set null" }),
    runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
    /** queued|sent|skipped|failed */
    status: text("status").notNull(),
    skipReason: text("skip_reason"),
    metadata: jsonb("metadata"),
  },
  (t) => ({
    ruleIdx: index("email_automation_runs_rule_idx").on(t.ruleId, t.runAt),
    contactIdx: index("email_automation_runs_contact_idx").on(t.contactId, t.ruleId, t.runAt),
  }),
);

/** F6 — ručně kurátorované články pro newsletter. */
export const emailContentSources = pgTable(
  "email_content_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url"),
    title: text("title"),
    description: text("description"),
    imageUrl: text("image_url"),
    sourceName: text("source_name"),
    isEvergreen: boolean("is_evergreen").notNull().default(false),
    capturedBy: text("captured_by"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    tags: text("tags").array().notNull().default([]),
    metadata: jsonb("metadata"),
  },
  (t) => ({
    tenantIdx: index("email_content_sources_tenant_idx").on(t.tenantId, t.capturedAt),
  }),
);

/** F5 — referral requests. */
export const referralRequests = pgTable(
  "referral_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id").notNull(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => emailCampaigns.id, { onDelete: "set null" }),
    token: text("token").notNull().unique(),
    /** sent|opened|submitted|expired */
    status: text("status").notNull().default("sent"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedContactId: uuid("submitted_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    rewardedAt: timestamp("rewarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index("referral_requests_tenant_idx").on(t.tenantId, t.createdAt),
    contactIdx: index("referral_requests_contact_idx").on(t.contactId, t.createdAt),
    statusIdx: index("referral_requests_status_idx").on(t.status),
  }),
);
