import type { TerminationDeliveryChannel } from "@/lib/db/schema-for-client";

/**
 * Lidské popisky kanálu doručení (DB enum, dispatch log i letter VM: post / databox / …).
 */
export function terminationDeliveryChannelLabel(channel: string): string {
  const c = channel as TerminationDeliveryChannel | "post" | "databox" | "portal" | "form";
  switch (c) {
    case "postal_mail":
    case "post":
      return "Pošta";
    case "email":
      return "E-mail";
    case "data_box":
    case "databox":
      return "Datová schránka";
    case "insurer_portal":
    case "portal":
      return "Portál pojišťovny";
    case "form":
      return "Formulář pojišťovny";
    case "in_person":
      return "Osobně";
    case "not_yet_set":
      return "Ještě nenastaveno";
    case "other":
      return "Jinak";
    default:
      return channel;
  }
}

/** Stav odeslání v dispatch logu. */
export function terminationDispatchStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Čeká";
    case "sent":
      return "Odesláno";
    case "delivered":
      return "Doručeno";
    case "failed":
      return "Selhalo";
    case "bounced":
      return "Vráceno";
    case "cancelled":
      return "Zrušeno";
    default:
      return status;
  }
}
