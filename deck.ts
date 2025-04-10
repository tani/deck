import { Hono } from 'npm:hono@4.7.6'
import { Marp } from 'npm:@marp-team/marp-core@4.0.0'
import * as cheerio from 'npm:cheerio@1.0.0'

const app = new Hono()

const cache = new Map<string, { md: string, pages: string[] }>()

app.get('/svg', async (c) => {
  const url = c.req.query('url')
  const pageParam = c.req.query('page')
  if (!url) {
    return c.text('Missing ?url=https://path.to/deck.md', 400)
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch markdown')
  const md = await res.text()

  let pages: string[] | undefined
  const cached = cache.get(url)

  if (cached && cached.md === md) {
    pages = cached.pages
  } else {
    const marp = new Marp()
    const { html, css } = marp.render(md)
    const cleanedCss = css.replace(/div\.marpit\s*>\s*svg\s*>\s*foreignObject\s*>/g, '')

    const $ = cheerio.load(`<div>${html}</div>`, { xmlMode: true })

    pages = $('svg[data-marpit-svg]').map((_i, elem) => {
      const $svg = $(elem)
      $svg.attr('xmlns', 'http://www.w3.org/2000/svg')
      const $section = $svg.find('section')
      $section.attr('xmlns', 'http://www.w3.org/1999/xhtml')
      $section.prepend(`<style>${cleanedCss}</style>`)
      return $.html($svg)
    }).get()

    cache.set(url, { md, pages })
  }

  const pageIndex = parseInt(pageParam ?? '0', 10)
  if (pageIndex < 0 || pageIndex >= pages.length) {
    return c.text(`Invalid page index. Must be 0 <= page < ${pages.length}`, 400)
  }

  return c.body(pages[pageIndex], 200, {
    'Content-Type': 'image/svg+xml; charset=utf-8'
  })
})

app.get('/html', async (c) => {
  const url = c.req.query('url')
  if (!url) {
    return c.text('Missing ?url=https://path.to/deck.md', 400)
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch markdown')
  const marp = new Marp()
  const md = await res.text()
  const { html, css } = marp.render(md)
  const page = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${css}</style>
      </head>
      <body class="marp">
        ${html}
      </body>
    </html>
  `
  return c.html(page)
})

app.get('/md', async (c) => {
  const url = c.req.query('url')
  if (!url) {
    return c.text('Missing ?url=https://path.to/deck.md', 400)
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch markdown')
  const marp = new Marp()
  const md = await res.text()
  const { html } = marp.render(md)
  const $ = cheerio.load(`<div>${html}</div>`)
  const svgCount = $('svg[data-marpit-svg]').length
  let code = ''
  for (let p = 0; p < svgCount; p++) {
    code += `![](https://slides.deno.dev/svg?url=${url}&page=${p}.svg)\n`
  }
  return c.text(code)
})

app.get('/sb', async (c) => {
  const url = c.req.query('url')
  if (!url) {
    return c.text('Missing ?url=https://path.to/deck.md', 400)
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch markdown')
  const marp = new Marp()
  const md = await res.text()
  const { html } = marp.render(md)
  const $ = cheerio.load(`<div>${html}</div>`)
  const svgCount = $('svg[data-marpit-svg]').length
  let code = ''
  for (let p = 0; p < svgCount; p++) {
    code += `[https://slides.deno.dev/svg?url=${url}&page=${p}.svg]\n`
  }
  return c.text(code)
})

app.get('/', (c) => {
  const page = `
    <!DOCTYPE html>
    <html lang="en" x-data="slideApp()">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>MD Slides</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css" rel="stylesheet">
        <!-- Alpine.js CDN -->
        <script src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js" defer></script>
        <style>
          .truncate-link {
            display: inline-block;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: bottom;
          }
          .github-ribbon {
            position: absolute;
            top: 0;
            right: 0;
            z-index: 9999;
            overflow: hidden;
            width: 150px;
            height: 150px;
          }
          .github-ribbon a {
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
          }
          .github-ribbon a:hover {
            background-color: #333;
          }
        </style>
      </head>
      <body class="bg-light">
        <div class="github-ribbon">
          <a href="https://github.com/tani/slides" target="_blank" rel="noopener noreferrer">⭐ Star on GitHub</a>
        </div>
        <div class="container py-5">
          <h1 class="mb-4">Markdown Slides</h1>
          <div class="card shadow-sm">
            <div class="card-body">
              <form x-on:submit.prevent="submitForm">
                <div class="mb-3">
                  <label for="url" class="form-label">Markdown URL</label>
                  <input type="url" class="form-control" id="url" placeholder="https://example.com/deck.md" x-model="url" required>
                </div>
                <div class="mb-3">
                  <label for="format" class="form-label">Select Output Format</label>
                  <select class="form-select" id="format" x-model="format">
                    <option value="html">HTML</option>
                    <option value="svg">SVG (Specify Page)</option>
                    <option value="md">Markdown Embed Code</option>
                    <option value="sb">Scrapbox Links</option>
                  </select>
                </div>
                <div class="mb-3" x-show="format === 'svg'">
                  <label for="page" class="form-label">Page Number (0-based)</label>
                  <input type="number" class="form-control" id="page" x-model.number="page" min="0" value="0">
                </div>
                <button type="submit" class="btn btn-primary">Display / Generate</button>
              </form>
            </div>
          </div>

          <div class="mt-4" x-show="generatedLink">
            <div class="alert alert-success">
              <strong>Link:</strong>
              <a :href="generatedLink" class="truncate-link" target="_blank" rel="noopener noreferrer" x-text="generatedLink"></a>
            </div>
          </div>

          <div class="mt-4" x-show="showOutput">
            <label for="output" class="form-label">Output Result</label>
            <textarea id="output" class="form-control" rows="6" readonly x-model="output"></textarea>
          </div>
        </div>

        <script>
          function slideApp() {
            return {
              url: '',
              format: 'html',
              page: 0,
              output: '',
              generatedLink: '',
              showOutput: false,
              async submitForm() {
                this.generatedLink = '';
                this.output = '';
                this.showOutput = false;
                if (!this.url) {
                  this.output = 'Please enter a URL.';
                  this.showOutput = true;
                  return;
                }
                if (this.format === 'svg') {
                  const link = \`/svg?url=\${encodeURIComponent(this.url)}&page=\${encodeURIComponent(this.page)}.svg\`;
                  this.generatedLink = link;
                } else if (this.format === 'html') {
                  const link = \`/html?url=\${encodeURIComponent(this.url)}\`;
                  this.generatedLink = link;
                } else {
                  try {
                    const res = await fetch(\`/\${this.format}?url=\${encodeURIComponent(this.url)}\`);
                    const text = await res.text();
                    this.output = res.ok ? text : \`Error: \${text}\`;
                    this.showOutput = true;
                  } catch (err) {
                    this.output = 'An error occurred while making the request.';
                    this.showOutput = true;
                  }
                }
              }
            }
          }
        </script>
      </body>
    </html>
  `;
  return c.html(page);
});

export default app
