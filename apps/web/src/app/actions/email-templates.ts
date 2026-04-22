"use server";

import {
  listAvailableTemplates,
  getTemplateById,
  saveCampaignAsTemplate,
  archiveTemplate,
  cloneGlobalTemplateToTenant,
  type EmailTemplateRow,
  type EmailTemplateKind,
} from "@/lib/email/template-repository";

export async function getEmailTemplatesAction(): Promise<EmailTemplateRow[]> {
  return listAvailableTemplates();
}

export async function getEmailTemplateAction(id: string): Promise<EmailTemplateRow | null> {
  return getTemplateById(id);
}

export async function saveCampaignAsTemplateAction(input: {
  name: string;
  subject: string;
  preheader?: string | null;
  bodyHtml: string;
  kind?: EmailTemplateKind;
  description?: string;
}): Promise<{ id: string }> {
  return saveCampaignAsTemplate(input);
}

export async function archiveEmailTemplateAction(id: string): Promise<{ ok: true }> {
  return archiveTemplate(id);
}

export async function cloneGlobalTemplateAction(input: {
  globalTemplateId: string;
  overrideName?: string;
}): Promise<{ id: string }> {
  return cloneGlobalTemplateToTenant(input.globalTemplateId, input.overrideName);
}
