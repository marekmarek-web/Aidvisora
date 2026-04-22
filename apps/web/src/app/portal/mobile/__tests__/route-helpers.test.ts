import { describe, expect, it } from "vitest";

import {
  decideHeaderBackAction,
  isDetailRoute,
  parseContactIdFromPath,
  parseHouseholdIdFromPath,
  parseOpportunityIdFromPath,
  pathnameToBottomTab,
  resolveParentRoute,
} from "../route-helpers";

describe("pathnameToBottomTab", () => {
  it("maps primary tabs correctly", () => {
    expect(pathnameToBottomTab("/portal/today")).toBe("home");
    expect(pathnameToBottomTab("/portal/today/something")).toBe("home");
    expect(pathnameToBottomTab("/portal/tasks")).toBe("tasks");
    expect(pathnameToBottomTab("/portal/tasks?filter=week")).toBe("tasks");
    expect(pathnameToBottomTab("/portal/contacts")).toBe("clients");
    expect(pathnameToBottomTab("/portal/contacts/abc-123")).toBe("clients");
    expect(pathnameToBottomTab("/portal/pipeline")).toBe("pipeline");
    expect(pathnameToBottomTab("/portal/pipeline/deal-7")).toBe("pipeline");
  });

  it("returns none for non-primary routes", () => {
    expect(pathnameToBottomTab("/portal/messages")).toBe("none");
    expect(pathnameToBottomTab("/portal/calendar")).toBe("none");
    expect(pathnameToBottomTab("/portal/ai")).toBe("none");
    expect(pathnameToBottomTab("/portal/households")).toBe("none");
    expect(pathnameToBottomTab("/client/messages")).toBe("none");
    expect(pathnameToBottomTab("/prihlaseni")).toBe("none");
  });
});

describe("isDetailRoute", () => {
  it("recognises dynamic-segment detail routes", () => {
    expect(isDetailRoute("/portal/contacts/contact-id")).toBe(true);
    expect(isDetailRoute("/portal/households/h-1")).toBe(true);
    expect(isDetailRoute("/portal/pipeline/deal-42")).toBe(true);
    expect(isDetailRoute("/portal/mindmap/map-id")).toBe(true);
    expect(isDetailRoute("/portal/contracts/review/review-id")).toBe(true);
    expect(isDetailRoute("/portal/calculators/investments")).toBe(true);
    expect(isDetailRoute("/portal/analyses/financial")).toBe(true);
    expect(isDetailRoute("/portal/analyses/financial/12345")).toBe(true);
    expect(isDetailRoute("/portal/scan")).toBe(true);
    expect(isDetailRoute("/portal/scan/existing-doc")).toBe(true);
  });

  it("does NOT treat hub routes as detail", () => {
    expect(isDetailRoute("/portal/today")).toBe(false);
    expect(isDetailRoute("/portal/contacts")).toBe(false);
    expect(isDetailRoute("/portal/pipeline")).toBe(false);
    expect(isDetailRoute("/portal/households")).toBe(false);
    expect(isDetailRoute("/portal/analyses")).toBe(false);
    expect(isDetailRoute("/portal/messages")).toBe(false);
  });

  it("treats /new as hub route, not detail", () => {
    expect(isDetailRoute("/portal/contacts/new")).toBe(false);
  });
});

describe("resolveParentRoute", () => {
  it("resolves parents for detail routes", () => {
    expect(resolveParentRoute("/portal/contacts/abc")).toBe("/portal/contacts");
    expect(resolveParentRoute("/portal/households/h-1")).toBe("/portal/households");
    expect(resolveParentRoute("/portal/pipeline/deal-42")).toBe("/portal/pipeline");
    expect(resolveParentRoute("/portal/mindmap/map-id")).toBe("/portal/mindmap");
    expect(resolveParentRoute("/portal/contracts/review/rev-7")).toBe("/portal/contracts/review");
    expect(resolveParentRoute("/portal/calculators/invest")).toBe("/portal/calculators");
    expect(resolveParentRoute("/portal/analyses/financial/12345")).toBe("/portal/analyses");
    expect(resolveParentRoute("/portal/scan/doc-1")).toBe("/portal/documents");
  });

  it("falls back to dashboard for unknown paths", () => {
    expect(resolveParentRoute("/portal/today")).toBe("/portal/today");
    expect(resolveParentRoute("/portal/messages")).toBe("/portal/today");
    expect(resolveParentRoute("/unknown")).toBe("/portal/today");
  });
});

describe("parse id helpers", () => {
  it("extracts contact id", () => {
    expect(parseContactIdFromPath("/portal/contacts/abc-123")).toBe("abc-123");
    expect(parseContactIdFromPath("/portal/contacts/abc-123/overview")).toBe("abc-123");
    expect(parseContactIdFromPath("/portal/contacts")).toBe(null);
  });

  it("extracts opportunity id", () => {
    expect(parseOpportunityIdFromPath("/portal/pipeline/deal-7")).toBe("deal-7");
    expect(parseOpportunityIdFromPath("/portal/pipeline")).toBe(null);
  });

  it("extracts household id", () => {
    expect(parseHouseholdIdFromPath("/portal/households/h-1")).toBe("h-1");
    expect(parseHouseholdIdFromPath("/portal/households")).toBe(null);
  });
});

describe("decideHeaderBackAction", () => {
  it("pops history when there's a prior entry", () => {
    const result = decideHeaderBackAction({
      pathname: "/portal/pipeline/deal-7",
      historyLength: 3,
    });
    expect(result).toEqual({ kind: "back" });
  });

  it("replaces to detail parent when cold-start on detail route", () => {
    const result = decideHeaderBackAction({
      pathname: "/portal/pipeline/deal-7",
      historyLength: 1,
    });
    expect(result).toEqual({ kind: "replace", target: "/portal/pipeline" });
  });

  it("replaces to /portal/today when cold-start on hub route", () => {
    const result = decideHeaderBackAction({
      pathname: "/portal/messages",
      historyLength: 1,
    });
    expect(result).toEqual({ kind: "replace", target: "/portal/today" });
  });

  it("treats historyLength 0 the same as 1 (safari / cold-start)", () => {
    const result = decideHeaderBackAction({
      pathname: "/portal/contacts/abc",
      historyLength: 0,
    });
    expect(result).toEqual({ kind: "replace", target: "/portal/contacts" });
  });
});
