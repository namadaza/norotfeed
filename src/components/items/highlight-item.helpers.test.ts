import { describe, expect, it } from "vitest";
import { buildHighlightSearchText } from "./highlight-item.helpers";

describe("buildHighlightSearchText", () => {
  it("includes highlight location context", () => {
    expect(
      buildHighlightSearchText({
        type: "highlight",
        id: "h1",
        title: "Infinite Jest",
        text: "There are feelings associated with fame.",
        author: "Tom Bissell, David Foster Wallace",
        source: "From Highlights",
        reference: "Year of the Depend Adult Undergarment · p. 1024",
      }),
    ).toContain("Source: From Highlights");

    expect(
      buildHighlightSearchText({
        type: "highlight",
        id: "h1",
        title: "Infinite Jest",
        text: "There are feelings associated with fame.",
        author: "Tom Bissell, David Foster Wallace",
        source: "From Highlights",
        reference: "Year of the Depend Adult Undergarment · p. 1024",
      }),
    ).toContain("Location: Year of the Depend Adult Undergarment · p. 1024");
  });
});
