import { Hono } from "hono";
import { css, Style } from "hono/css";
import { raw } from "hono/html";

import { Marp } from "marp-core";
import * as cheerio from "cheerio";

const app = new Hono();

const cache = new Map<string, { md: string; pages: string[] }>();

app.get("/svg", async (c) => {
  const url = c.req.query("url");
  const pageParam = c.req.query("page");
  if (!url) {
    return c.text("Missing ?url=https://path.to/deck.md", 400);
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch markdown");
  const md = await res.text();

  let pages: string[] | undefined;
  const cached = cache.get(url);

  if (cached && cached.md === md) {
    pages = cached.pages;
  } else {
    const marp = new Marp({
      html: true,
      emoji: { shortcode: true },
      script: false,
    });
    const { html, css } = marp.render(md);
    const cleanedCss = css.replace(
      /div\.marpit\s*>\s*svg\s*>\s*foreignObject\s*>/g,
      "",
    );

    const $ = cheerio.load((<div>{raw(html)}</div>).toString(), {
      xmlMode: true,
    });

    pages = $("svg[data-marpit-svg]").map((_i, elem) => {
      const $svg = $(elem);
      $svg.attr("xmlns", "http://www.w3.org/2000/svg");
      const $section = $svg.find("section");
      $section.attr("xmlns", "http://www.w3.org/1999/xhtml");
      $section.prepend((<style>{cleanedCss}</style>).toString());
      return $.html($svg);
    }).get();

    cache.set(url, { md, pages });
  }

  const pageIndex = parseInt(pageParam ?? "0", 10);
  if (pageIndex < 0 || pageIndex >= pages.length) {
    return c.text(
      `Invalid page index. Must be 0 <= page < ${pages.length}`,
      400,
    );
  }

  return c.body(pages[pageIndex], 200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
  });
});

app.get("/html", async (c) => {
  const url = c.req.query("url");
  if (!url) {
    return c.text("Missing ?url=https://path.to/deck.md", 400);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch markdown");
  const marp = new Marp({ html: true, emoji: { shortcode: true } });
  const md = await res.text();
  const { html, css } = marp.render(md);
  return c.html(
    <>
      {raw(`<!DOCTYPE html>`)}
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <style>{raw(css)}</style>
        </head>
        <body class="marp">
          {raw(html)}
        </body>
      </html>
    </>,
  );
});

app.get("/generate", async (c) => {
  const url = c.req.query("url");
  const format = c.req.query("format") ?? "html";
  const page = parseInt(c.req.query("page") ?? "0");

  if (!url) {
    return c.text("Missing ?url=https://path.to/deck.md", 400);
  }

  const renderLinkHTML = (link: string) => (
    <div id="output" class="mt-4">
      <div class="alert alert-success">
        <strong>Link:</strong>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link}
        </a>
      </div>
    </div>
  );

  const renderCodeHTML = (code: string) => (
    <div id="output" class="mt-4">
      <div class="alert alert-success">
        <strong>Code:</strong>
        <div class="text-bg-light rounded p-3">
          <pre><code>{code}</code></pre>
        </div>
      </div>
    </div>
  );

  if (format === "html") {
    return c.html(renderLinkHTML(`/html?url=${url}`));
  }

  if (format === "svg") {
    return c.html(renderLinkHTML(`/svg?url=${url}&page=${page}.svg`));
  }

  const generateCode = async (prefix: string, wrap = false) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch markdown");

    const md = await res.text();
    const marp = new Marp();
    const { html } = marp.render(md);
    const $ = cheerio.load((<div>{raw(html)}</div>).toString());
    const svgCount = $("svg[data-marpit-svg]").length;
    let output = "";
    for (let i = 0; i < svgCount; i++) {
      const line = `${prefix}${url}&page=${i}.svg`;
      output += wrap ? `[${line}]\n` : `![](${line})\n`;
    }
    return output;
  };

  if (format === "md") {
    return c.html(
      renderCodeHTML(await generateCode("https://slides.deno.dev/svg?url=")),
    );
  }

  if (format === "sb") {
    return c.html(
      renderCodeHTML(
        await generateCode("https://slides.deno.dev/svg?url=", true),
      ),
    );
  }

  return c.text("Unsupported format", 400);
});

const githubRibbon = css`
  position: absolute;
  top: 0;
  right: 0;
  z-index: 9999;
  overflow: hidden;
  width: 150px;
  height: 150px;
`;

const githubRibbonLink = css`
  position: absolute;
  display: block;
  width: 200px;
  padding: 8px 0;
  background: #151513;
  color: #fff;
  text-align: center;
  font: 700 13px "Arial", sans-serif;
  text-decoration: none;
  transform: rotate(45deg);
  top: 30px;
  right: -50px;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.2);
  &:hover {
    background-color: #333;
  }
`;

app.get("/", (c) => {
  return c.html(
    <>
      {raw(`<!DOCTYPE html>`)}
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>MD Slides</title>
          <script
            type="module"
            src="https://cdn.jsdelivr.net/npm/htmx.org@2"
            defer
          >
          </script>
          <link
            href="https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css"
            rel="stylesheet"
          />
          <Style />
          <style>
            {`form .mb-3:has([value="svg"]:not(:checked)) + .mb-3 { display: none; }`}
          </style>
        </head>
        <body class="bg-light">
          <div class={githubRibbon}>
            <a
              class={githubRibbonLink}
              href="https://github.com/tani/slides"
              target="_blank"
              rel="noopener noreferrer"
            >
              ⭐ Star on GitHub
            </a>
          </div>
          <div class="container py-5">
            <h1 class="mb-4">MD Slides</h1>
            <div class="card shadow-sm">
              <div class="card-body">
                <form hx-get="/generate" hx-target="#output">
                  <div class="mb-3">
                    <label for="url" class="form-label">Markdown URL</label>
                    <input
                      type="url"
                      class="form-control"
                      name="url"
                      placeholder="https://example.com/deck.md"
                      required
                    />
                  </div>
                  <div class="mb-3">
                    <label for="format" class="form-label">
                      Select Output Format
                    </label>
                    <select class="form-select" name="format">
                      <option value="html">HTML</option>
                      <option value="svg">SVG (Specify Page)</option>
                      <option value="md">Markdown Embed Code</option>
                      <option value="sb">Scrapbox Links</option>
                    </select>
                  </div>
                  <div class="mb-3">
                    <label for="page" class="form-label">
                      Page Number (0-based)
                    </label>
                    <input
                      type="number"
                      class="form-control"
                      name="page"
                      min="0"
                      value="0"
                    />
                  </div>
                  <button type="submit" class="btn btn-primary">
                    Display / Generate
                  </button>
                </form>
              </div>
            </div>
            <div id="output" class="mt-4">
            </div>
          </div>
        </body>
      </html>
    </>,
  );
});

export default app;
