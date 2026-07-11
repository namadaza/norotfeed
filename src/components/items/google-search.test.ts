import { describe, expect, it } from "vitest";
import { googleSearchUrl } from "./google-search";

describe("googleSearchUrl", () => {
  it("keeps all text and turns separators into line breaks", () => {
    const url = googleSearchUrl("INFINITE JEST · There are feelings · From Highlights");

    expect(url).toContain(
      encodeURIComponent("give more context to this\n\nINFINITE JEST\nThere are feelings\nFrom Highlights"),
    );
  });
});
