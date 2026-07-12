import { describe, expect, it } from "vitest";
import { getWelcomeOnboardingItem, injectOnboardingItems } from "./onboarding";

describe("injectOnboardingItems", () => {
  it("keeps the welcome card first and inserts a tip after every three posts", () => {
    const items = Array.from({ length: 7 }, (_value, index) => ({
      type: "rss" as const,
      id: `rss-${index + 1}`,
      title: `Item ${index + 1}`,
      url: "https://example.com",
      publication: "Example",
    }));

    const result = injectOnboardingItems(items, "seed-123");

    expect(result[0]).toMatchObject({
      type: "onboarding",
      id: "onboarding-welcome",
    });
    expect(result.filter((item) => item.type === "onboarding")).toHaveLength(3);
    expect(result[1]).toMatchObject({ type: "rss", id: "rss-1" });
    expect(result[4]).toMatchObject({ type: "onboarding" });
    expect(result[8]).toMatchObject({ type: "onboarding" });
  });

  it("customizes the welcome card for art and islam routes", () => {
    expect(getWelcomeOnboardingItem("art")).toMatchObject({
      title: expect.stringContaining("art"),
      body: expect.stringContaining("WikiArt"),
    });

    expect(getWelcomeOnboardingItem("islam")).toMatchObject({
      title: expect.stringContaining("Islam"),
      body: expect.stringContaining("Quran"),
    });
  });
});
