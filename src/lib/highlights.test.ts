import { describe, it, expect } from "vitest";
import {
  parseHighlightUpload,
  dedupParsedHighlights,
  highlightId,
  normalizeTextForDedup,
  normalizeTitleForDedup,
  UNTITLED_HIGHLIGHT_TITLE,
} from "./highlights";

const USER_ID = "user-123";

describe("normalizeTextForDedup", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeTextForDedup("  Hello   World  ")).toBe("hello world");
  });

  it("collapses newlines into spaces", () => {
    expect(normalizeTextForDedup("Hello\n\nWorld")).toBe("hello world");
  });
});

describe("normalizeTitleForDedup", () => {
  it("strips subtitles and 'by author' suffixes", () => {
    expect(normalizeTitleForDedup("Infinite Jest: A Novel")).toBe("infinite jest");
    expect(normalizeTitleForDedup("Dune by Frank Herbert")).toBe("dune");
  });

  it("lowercases and normalizes punctuation", () => {
    expect(normalizeTitleForDedup("The Lord of the Rings!")).toBe("the lord of the rings");
  });
});

describe("highlightId", () => {
  it("is deterministic for the same input", () => {
    expect(highlightId(USER_ID, "Dune", "Fear is the mind-killer."))
      .toBe(highlightId(USER_ID, "Dune", "Fear is the mind-killer."));
  });

  it("ignores trivial title formatting differences", () => {
    const a = highlightId(USER_ID, "Dune", "Fear is the mind-killer.");
    const b = highlightId(USER_ID, "Dune: A Novel", "Fear is the mind-killer.");
    expect(a).toBe(b);
  });

  it("ignores trivial whitespace differences in body", () => {
    const a = highlightId(USER_ID, "Dune", "Fear is the  mind-killer.");
    const b = highlightId(USER_ID, "Dune", "Fear is the mind-killer.");
    expect(a).toBe(b);
  });

  it("differs per user", () => {
    expect(highlightId(USER_ID, "Dune", "x")).not.toBe(
      highlightId("user-456", "Dune", "x"),
    );
  });

  it("starts with the uh- prefix", () => {
    expect(highlightId(USER_ID, "Dune", "x").startsWith("uh-")).toBe(true);
  });
});

describe("parseHighlightUpload", () => {
  it("parses { highlights: [...] }", () => {
    const result = parseHighlightUpload({
      highlights: [
        { title: "Dune", author: "Frank Herbert", text: "Fear is the mind-killer." },
        { title: "Dune", text: "Another line." },
      ],
    });
    expect(result.highlights).toHaveLength(2);
    expect(result.highlights[0].title).toBe("Dune");
    expect(result.highlights[0].data.text).toBe("Fear is the mind-killer.");
    expect(result.highlights[0].data.author).toBe("Frank Herbert");
    expect(result.errors).toEqual([]);
  });

  it("parses a bare array", () => {
    const result = parseHighlightUpload([
      { text: "One" },
      { text: "Two" },
    ]);
    expect(result.highlights).toHaveLength(2);
    expect(result.highlights[0].data.text).toBe("One");
  });

  it("parses a single highlight object", () => {
    const result = parseHighlightUpload({ text: "Solo", title: "Misc" });
    expect(result.highlights).toHaveLength(1);
    expect(result.highlights[0].title).toBe("Misc");
  });

  it("parses { books: [{ title, author, highlights }] } and inherits book metadata", () => {
    const result = parseHighlightUpload({
      books: [
        {
          title: "Dune",
          author: "Frank Herbert",
          highlights: [
            { text: "Fear is the mind-killer.", reference: "Chapter 1" },
            { text: "The sleeper must awaken." },
          ],
        },
      ],
    });
    expect(result.highlights).toHaveLength(2);
    expect(result.highlights[0].title).toBe("Dune");
    expect(result.highlights[0].data.author).toBe("Frank Herbert");
    expect(result.highlights[0].data.reference).toBe("Chapter 1");
    expect(result.highlights[1].data.author).toBe("Frank Herbert");
  });

  it("falls back to the book title when an entry omits its own title", () => {
    const result = parseHighlightUpload({
      books: [{ title: "Dune", highlights: [{ text: "x" }] }],
    });
    expect(result.highlights[0].title).toBe("Dune");
  });

  it("uses the untitled fallback when no title is provided", () => {
    const result = parseHighlightUpload({ text: "no title" });
    expect(result.highlights[0].title).toBe(UNTITLED_HIGHLIGHT_TITLE);
  });

  it("accepts body as an alias for text", () => {
    const result = parseHighlightUpload({ body: "body text" });
    expect(result.highlights[0].data.text).toBe("body text");
  });

  it("skips entries with empty text and reports skipped count", () => {
    const result = parseHighlightUpload({
      highlights: [
        { text: "   " },
        { title: "Dune", text: "valid" },
        { text: "" },
      ],
    });
    expect(result.highlights).toHaveLength(1);
    expect(result.skipped).toBe(2);
  });

  it("preserves meaningful line breaks in text", () => {
    const result = parseHighlightUpload({
      highlights: [{ text: "Line one.\nLine two.\nLine three." }],
    });
    expect(result.highlights[0].data.text).toBe("Line one.\nLine two.\nLine three.");
  });

  it("collapses runs of whitespace within a line", () => {
    const result = parseHighlightUpload({
      highlights: [{ text: "too   much   space" }],
    });
    expect(result.highlights[0].data.text).toBe("too much space");
  });

  it("returns an error for unrecognized shapes", () => {
    const result = parseHighlightUpload({ foo: "bar" });
    expect(result.highlights).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns an error for non-object input", () => {
    const result = parseHighlightUpload("not json");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("strips empty optional fields", () => {
    const result = parseHighlightUpload({
      highlights: [{ text: "x", author: "   ", reference: "" }],
    });
    expect(result.highlights[0].data.author).toBeUndefined();
    expect(result.highlights[0].data.reference).toBeUndefined();
  });
});

describe("dedupParsedHighlights", () => {
  it("collides duplicate entries by text+title and keeps one", () => {
    const rows = [
      { title: "Dune", data: { text: "Fear is the mind-killer." } },
      { title: "Dune", data: { text: "Fear is the mind-killer." } },
    ];
    const deduped = dedupParsedHighlights(USER_ID, rows);
    expect(deduped).toHaveLength(1);
  });

  it("keeps the entry with richer metadata on collision", () => {
    const rows = [
      { title: "Dune", data: { text: "Fear is the mind-killer." } },
      {
        title: "Dune",
        data: {
          text: "Fear is the mind-killer.",
          author: "Frank Herbert",
          reference: "Chapter 1",
        },
      },
    ];
    const deduped = dedupParsedHighlights(USER_ID, rows);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].data.author).toBe("Frank Herbert");
    expect(deduped[0].data.reference).toBe("Chapter 1");
  });

  it("does not collide highlights with different text", () => {
    const rows = [
      { title: "Dune", data: { text: "One" } },
      { title: "Dune", data: { text: "Two" } },
    ];
    expect(dedupParsedHighlights(USER_ID, rows)).toHaveLength(2);
  });

  it("does not collide highlights with different titles", () => {
    const rows = [
      { title: "Dune", data: { text: "Same text" } },
      { title: "Gitanjali", data: { text: "Same text" } },
    ];
    expect(dedupParsedHighlights(USER_ID, rows)).toHaveLength(2);
  });

  it("collides across trivial title formatting differences", () => {
    const rows = [
      { title: "Dune", data: { text: "Fear is the mind-killer." } },
      { title: "Dune: A Novel", data: { text: "Fear is the mind-killer." } },
    ];
    expect(dedupParsedHighlights(USER_ID, rows)).toHaveLength(1);
  });

  it("collides across trivial whitespace differences in body", () => {
    const rows = [
      { title: "Dune", data: { text: "Fear  is the mind-killer." } },
      { title: "Dune", data: { text: "Fear is the mind-killer." } },
    ];
    expect(dedupParsedHighlights(USER_ID, rows)).toHaveLength(1);
  });
});
