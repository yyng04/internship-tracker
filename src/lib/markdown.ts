// Tiny markdown subset: paragraphs, # ## ### headings, **bold**, *italic*,
// "- " bullet lists, and single line breaks inside a paragraph become <br>.
// Input is HTML-escaped first so raw HTML never reaches the page.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
}

export function renderMarkdown(md: string): string {
  const blocks = escapeHtml(md.replace(/\r\n?/g, '\n')).trim().split(/\n{2,}/)
  const out: string[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      const heading = /^(#{1,3})\s+(.*)$/.exec(line)
      if (heading) {
        const level = heading[1].length
        out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
        i++
        continue
      }
      if (/^-\s+/.test(line)) {
        const items: string[] = []
        while (i < lines.length && /^-\s+/.test(lines[i])) {
          items.push(`<li>${inline(lines[i].replace(/^-\s+/, ''))}</li>`)
          i++
        }
        out.push(`<ul>${items.join('')}</ul>`)
        continue
      }
      // Paragraph: consume until a heading or list line starts.
      const para: string[] = []
      while (i < lines.length && !/^(#{1,3}\s+|-\s+)/.test(lines[i])) {
        para.push(inline(lines[i]))
        i++
      }
      if (para.length) out.push(`<p>${para.join('<br>')}</p>`)
    }
  }
  return out.join('\n')
}

/** Strip markdown syntax so the text pastes cleanly into a form or email. */
export function markdownToPlain(md: string): string {
  return md
    .replace(/\r\n?/g, '\n')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1$2')
    .replace(/^-\s+/gm, '- ')
    .trim()
}
