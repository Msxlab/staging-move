import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import { navGroups, quickActions } from "./admin-nav";

describe("admin navigation i18n", () => {
  it("has messages for every sidebar and quick-action label", () => {
    const keys = [
      ...navGroups.flatMap((group) => [group.labelKey, ...group.items.map((item) => item.nameKey)]),
      ...quickActions.map((action) => action.nameKey),
    ];

    for (const key of new Set(keys)) {
      expect(en.nav, `en.nav.${key}`).toHaveProperty(key);
      expect(es.nav, `es.nav.${key}`).toHaveProperty(key);
    }
  });
});
