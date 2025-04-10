---
marp: true
theme: default
class: lead
---

# slides.deno.dev
### A Marp Slide Viewer App  
by tani

---

## Introduction
- **slides.deno.dev** is a simple slide generation service built with Deno.
- It converts slide decks written in Markdown into HTML and displays them in the browser.

---

## System Architecture
- **Deno**  
  A modern runtime environment for executing server-side code
- **Hono**  
  A lightweight HTTP server framework
- **Marp**  
  An open-source tool for converting Markdown into slides

---

## Workflow
1. Prepare a Markdown file
2. Access the service with the Markdown file's URL specified as a parameter  
   https://slides.deno.dev/html?url=https://raw.githubusercontent.com/tani/deck/refs/heads/main/README.md
3. The server fetches the specified file and converts it using Marp
4. A page containing the converted HTML and CSS is returned, and the slides are displayed

---

## Error Handling
- If no URL is provided:  
  A 400 error is returned with the message “Missing ?url=https://path.to/deck.md”
- If Markdown fetching or conversion fails:  
  A 500 error with an error message is returned

---

## Summary
- **slides.deno.dev** is a tool that simply generates slides from Markdown.
- It leverages Deno, Hono, and Marp, allowing users to easily create and share slides.

---

## References
- [Deno](https://deno.land)
- [Hono](https://hono.dev)
- [Marp](https://marp.app)
