import { Hono } from 'jsr:@hono/hono'
import { Marp } from 'npm:@marp-team/marp-core'

const app = new Hono()

const marp = new Marp({html: true})

app.get('/', async (c) => {
  const url = c.req.query('url')
  if (!url) {
    return c.text('Missing ?url=https://path.to/deck.md', 400)
  }

  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error('Failed to fetch markdown')
    }

    const md = await res.text()

    const { html, css } = marp.render(md)

    const page = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              background-color: #333;
            }
            ${css}
          </style>
        </head>
        <body class="marp">
          ${html}
        </body>
      </html>
    `

    return c.html(page)
  } catch (err: unknown) {
    if (err instanceof Error) {
      return c.text(`Error: ${err.message}`, 500)
    } else {
      return c.text(`Error: ${err}`, 500)
    }
  }
})

export default app
