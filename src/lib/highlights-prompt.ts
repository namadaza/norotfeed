export const HIGHLIGHTS_JSON_EXAMPLE = `{
  "highlights": [
    {
      "title": "Dune",
      "author": "Frank Herbert",
      "text": "Fear is the mind-killer.",
      "reference": "Chapter 1 · p. 8",
      "url": "https://example.com/dune"
    }
  ]
}`;

export const HIGHLIGHTS_AI_PROMPT = `You are formatting book highlights for No Rot Feed.

Convert the user's raw highlights below into this exact JSON shape:

{
  "highlights": [
    {
      "title": "<book title>",
      "author": "<author name, if known>",
      "text": "<the highlight text, verbatim>",
      "reference": "<chapter and/or page, if known, e.g. 'Chapter 3 · p. 45'>",
      "url": "<source URL, if applicable>"
    }
  ]
}

Rules:
- Output ONLY the JSON. No prose, no code fences, no commentary.
- Use the same "title" and "author" for every highlight from the same book.
- Preserve the highlight wording exactly. Collapse runs of whitespace to a single space; keep line breaks only when they are meaningful (e.g. poetry).
- Drop duplicate or near-duplicate highlights (same wording, different page numbers -> keep the one with the richer reference).
- Omit empty optional fields rather than emitting empty strings.
- If the source provides chapter/page metadata, include it in "reference" joined by " · ".
- If the source is a URL or web article, put the link in "url" and the article title in "title".

Raw highlights:
<paste your highlights, KOReader export, Kindle notes, or any notes here>`;
