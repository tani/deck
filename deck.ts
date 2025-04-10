import { Hono } from 'npm:hono'
import { Marp } from 'npm:@marp-team/marp-core'
import { JSDOM } from 'npm:jsdom'

const app = new Hono()

app.get('/svg', async (c) => {
  const url = c.req.query('url')
  const pageParam = c.req.query('page')
  if (!url) {
    return c.text('Missing ?url=https://path.to/deck.md', 400)
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch markdown')
  const marp = new Marp()
  const md = await res.text()
  const { html, css } = marp.render(md)
  const cleanedCss = css.replace(/div\.marpit\s*>\s*svg\s*>\s*foreignObject\s*>/g, '')
  const dom = new JSDOM(`<div>${html}</div>`, { contentType: 'text/html' })
  const document = dom.window.document
  const svgs = document.querySelectorAll('svg[data-marpit-svg]')
  const pageIndex = parseInt(pageParam ?? '0', 10)
  if (pageIndex < 0 || pageIndex >= svgs.length) {
    return c.text(`Invalid page index. Must be 0 <= page < ${svgs.length}`, 400)
  }
  const svg = svgs[pageIndex].cloneNode(true) as HTMLElement
  if (!svg.hasAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }
  const foreignObject = svg.querySelector('foreignObject')
  if (foreignObject) {
    const xmlns = 'http://www.w3.org/1999/xhtml'
    const container = document.createElementNS(xmlns, 'div')
    container.setAttribute('xmlns', xmlns)
    const style = document.createElementNS(xmlns, 'style')
    style.innerHTML = cleanedCss
    container.appendChild(style)
    container.appendChild(foreignObject.querySelector('section'))
    foreignObject.innerHTML = ''
    foreignObject.appendChild(container)
  }
  const serializedSvg = svg.outerHTML.replace(/<br>/g, '<br />');
  return c.body(serializedSvg, 200, {
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
  // Output as standard HTML page when not generating SVG
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
  `;

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
  const dom = new JSDOM(`<div>${html}</div>`, { contentType: 'text/html' })
  const document = dom.window.document
  const svgs = document.querySelectorAll('svg[data-marpit-svg]')
  let code = '';
  for (let p = 0; p < svgs.length; p++) {
    code += `![](https://slides.deno.dev/svg?url=${url}&page=${p}.svg)\n`
  }
  return c.text(code);
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
  const dom = new JSDOM(`<div>${html}</div>`, { contentType: 'text/html' })
  const document = dom.window.document
  const svgs = document.querySelectorAll('svg[data-marpit-svg]')
  let code = '';
  for (let p = 0; p < svgs.length; p++) {
    code += `[https://slides.deno.dev/svg?url=${url}&page=${p}.svg]\n`
  }
  return c.text(code);
})

app.get('/', (c) => {
  const page = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Marp Slide Viewer</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        .truncate-link {
          display: inline-block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          vertical-align: bottom;
        }
      </style>
    </head>
    <body class="bg-light">
      <div class="container py-5">
        <h1 class="mb-4">Marp Slide Viewer</h1>

        <div class="card shadow-sm">
          <div class="card-body">
            <form id="slideForm">
              <div class="mb-3">
                <label for="url" class="form-label">Slide Markdown URL</label>
                <input type="url" class="form-control" id="url" placeholder="https://example.com/deck.md" required>
              </div>

              <div class="mb-3">
                <label for="format" class="form-label">Select Output Format</label>
                <select class="form-select" id="format">
                  <option value="svg">SVG (First Page)</option>
                  <option value="html">HTML</option>
                  <option value="md">Markdown Embed Code</option>
                  <option value="sb">Scrapbox Links</option>
                </select>
              </div>

              <button type="submit" class="btn btn-primary">Display / Generate</button>
            </form>
          </div>
        </div>

        <div class="mt-4" id="resultArea">
          <label for="output" class="form-label d-none" id="outputLabel">Output Result</label>
          <textarea id="output" class="form-control d-none" rows="6" readonly></textarea>
          <div id="linkOutput" class="mt-3 d-none">
            <div class="alert alert-success">
              <strong>Link:</strong>
              <a href="#" id="generatedLink" class="truncate-link" target="_blank" rel="noopener noreferrer"></a>
            </div>
          </div>
        </div>
      </div>

      <script>
        document.getElementById('slideForm').addEventListener('submit', async (e) => {
          e.preventDefault()

          const url = document.getElementById('url').value.trim()
          const format = document.getElementById('format').value
          const output = document.getElementById('output')
          const outputLabel = document.getElementById('outputLabel')
          const linkOutput = document.getElementById('linkOutput')
          const generatedLink = document.getElementById('generatedLink')

          // Reset output
          output.classList.add('d-none')
          outputLabel.classList.add('d-none')
          linkOutput.classList.add('d-none')
          generatedLink.textContent = ''
          generatedLink.removeAttribute('title')

          if (!url) {
            output.value = 'Please enter a URL.'
            output.classList.remove('d-none')
            outputLabel.classList.remove('d-none')
            return
          }

          if (format === 'svg') {
            const link = \`/svg?url=\${encodeURIComponent(url)}&page=0.svg\`
            generatedLink.href = link
            generatedLink.title = link
            generatedLink.textContent = link
            linkOutput.classList.remove('d-none')
          } else if (format === 'html') {
            const link = \`/html?url=\${encodeURIComponent(url)}\`
            generatedLink.href = link
            generatedLink.title = link
            generatedLink.textContent = link
            linkOutput.classList.remove('d-none')
          } else {
            try {
              const res = await fetch(\`/\${format}?url=\${encodeURIComponent(url)}\`)
              const text = await res.text()
              output.value = res.ok ? text : \`Error: \${text}\`
              output.classList.remove('d-none')
              outputLabel.classList.remove('d-none')
            } catch (err) {
              output.value = 'An error occurred while making the request.'
              output.classList.remove('d-none')
              outputLabel.classList.remove('d-none')
            }
          }
        })
      </script>
    </body>
    </html>
  `
  return c.html(page)
})

export default app
