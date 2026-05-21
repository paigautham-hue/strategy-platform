/**
 * Unit tests — HTML→text & source text extraction (pure paths)
 * server/ingest/html-to-text.ts · server/ingest/extract-text.ts
 */

import { describe, it, expect } from "vitest";
import { htmlToText, decodeHtmlEntities } from "../ingest/html-to-text";
import { markdownToText, extractText } from "../ingest/extract-text";

describe("html-to-text — decodeHtmlEntities", () => {
  it("decodes named entities", () => {
    expect(decodeHtmlEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeHtmlEntities("5 &lt; 10 &gt; 3")).toBe("5 < 10 > 3");
    expect(decodeHtmlEntities("a&nbsp;b")).toBe("a b");
  });

  it("decodes numeric and hex entities", () => {
    expect(decodeHtmlEntities("&#65;&#66;&#67;")).toBe("ABC");
    expect(decodeHtmlEntities("&#x41;&#x42;")).toBe("AB");
  });

  it("leaves unknown entities untouched", () => {
    expect(decodeHtmlEntities("&notreal;")).toBe("&notreal;");
  });
});

describe("html-to-text — htmlToText", () => {
  it("strips tags and keeps text content", () => {
    expect(htmlToText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("drops script and style content entirely", () => {
    const html = "<p>Keep</p><script>var x = 1;</script><style>.a{color:red}</style>";
    const text = htmlToText(html);
    expect(text).toContain("Keep");
    expect(text).not.toContain("var x");
    expect(text).not.toContain("color:red");
  });

  it("separates paragraphs with a blank line and <br> with a single break", () => {
    // Paragraphs become \n\n so the chunker can split on paragraph boundaries.
    expect(htmlToText("<p>One</p><p>Two</p>")).toBe("One\n\nTwo");
    // <br> is a soft break — a single newline.
    expect(htmlToText("Line A<br>Line B")).toBe("Line A\nLine B");
  });

  it("gives headings their own paragraph", () => {
    const text = htmlToText("<h1>Title</h1><p>Body text here</p>");
    expect(text).toContain("Title");
    expect(text).toContain("Body text here");
    expect(text.indexOf("Title")).toBeLessThan(text.indexOf("Body"));
  });

  it("decodes entities after stripping tags", () => {
    expect(htmlToText("<p>Tom &amp; Jerry</p>")).toBe("Tom & Jerry");
  });

  it("drops HTML comments", () => {
    expect(htmlToText("<p>Visible</p><!-- hidden comment -->")).toBe("Visible");
  });

  it("collapses runs of blank lines to at most one", () => {
    // Many blank lines between paragraphs collapse to a single \n\n.
    expect(htmlToText("<p>A</p>\n\n\n\n<p>B</p>")).toBe("A\n\nB");
  });

  it("handles empty input", () => {
    expect(htmlToText("")).toBe("");
  });
});

describe("extract-text — markdownToText", () => {
  it("strips heading hashes", () => {
    expect(markdownToText("# Big Title\n\nbody")).toBe("Big Title\n\nbody");
  });

  it("unwraps emphasis and inline code", () => {
    expect(markdownToText("This is **bold** and *italic* and `code`.")).toBe(
      "This is bold and italic and code.",
    );
  });

  it("keeps link text, drops the URL", () => {
    expect(markdownToText("See [our report](https://example.com/r) now.")).toBe(
      "See our report now.",
    );
  });

  it("strips list and blockquote markers", () => {
    expect(markdownToText("- item one\n- item two")).toBe("item one\nitem two");
    expect(markdownToText("> a quote")).toBe("a quote");
  });
});

describe("extract-text — extractText dispatch (pure paths)", () => {
  it("text passthrough normalizes line endings and trims", async () => {
    const r = await extractText("text", "  hello\r\nworld  ");
    expect(r.text).toBe("hello\nworld");
    expect(r.sourceType).toBe("text");
  });

  it("markdown source is cleaned", async () => {
    const r = await extractText("markdown", "## Heading\n\n**strong** point");
    expect(r.text).toBe("Heading\n\nstrong point");
  });

  it("html source is converted", async () => {
    const r = await extractText("html", "<p>Hello <i>there</i></p>");
    expect(r.text).toBe("Hello there");
  });
});
