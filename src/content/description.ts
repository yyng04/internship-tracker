import type { JobDescription } from '../types'

type Section = 'responsibilities' | 'requirements' | 'preferred'
type Line = { text: string; bullet: boolean }

const BLOCK = new Set([
  'P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BR', 'HR',
  'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'TR', 'DT', 'DD', 'BLOCKQUOTE',
])
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'BUTTON', 'FORM', 'INPUT', 'SELECT', 'TEXTAREA', 'NAV'])
const BULLET = /^\s*(?:[-•·*–▪●◦]|\d{1,2}[.)])\s+/
const BULLET_MARK = '\u0000'

// Headings are matched by phrase anywhere in a short line, since many listings use
// sentences such as "We'd love to hear from you if you have:". Checked in order, so
// "Preferred Qualifications" matches before "Qualifications". A null section ends
// the current one, for trailing company boilerplate.
const A = "(?:'|’)"
const HEADINGS: [Section | null, RegExp][] = [
  [null, /\b(about (?:us|the company|tiktok|bytedance)|benefits|perks|why join|what we offer|our commitment|equal (?:employment )?opportunity|pay transparency|compensation|salary range|accommodations?|job information|how to apply|privacy|one of our values|life at|deadline)\b/i],
  ['preferred', new RegExp(`\\b(preferred|nice[- ]to[- ]haves?|bonus|good[- ]to[- ]haves?|desirable|added plus|a plus|not required)\\b`, 'i')],
  ['requirements', new RegExp(`\\b(minimum|basic qualifications|requirements?|qualifications|what you${A}ll need|looking for|who you are|about you|if you have|you have:|good fit|ideal candidate|your background|skills|must[- ]haves?|eligibility|you bring|we${A}d love to hear|what we value)\\b`, 'i')],
  ['responsibilities', new RegExp(`\\b(responsibilities|duties|what you${A}ll do|what you will do|you could work on|you${A}ll work on|what you${A}ll work on|day[- ]to[- ]day|in this role|your role|the role|role overview|job description|your impact|as an intern)\\b`, 'i')],
]

const MAX_TEXT = 20_000
const MAX_ITEMS = 25

/** Whether the page displays newlines inside this element's text as line breaks. */
function keepsNewlines(el: Element | null): boolean {
  if (!el) return false
  try {
    const ws = getComputedStyle(el).whiteSpace
    return ws.startsWith('pre') || ws === 'break-spaces'
  } catch {
    return false
  }
}

function flatten(node: Node, out: string[]) {
  if (node.nodeType === 3) {
    const raw = node.textContent ?? ''
    out.push(keepsNewlines(node.parentElement) ? raw : raw.replace(/\s+/g, ' '))
    return
  }
  if (node.nodeType !== 1) return
  const el = node as Element
  if (SKIP.has(el.tagName)) return
  const block = BLOCK.has(el.tagName)
  if (block) out.push('\n')
  if (el.tagName === 'LI') out.push(BULLET_MARK)
  for (const child of el.childNodes) flatten(child, out)
  if (block) out.push('\n')
}

/** Flatten an element into lines, breaking at block elements and at displayed newlines. */
export function toLines(root: Element): Line[] {
  const out: string[] = []
  flatten(root, out)
  return out
    .join('')
    .split('\n')
    .map((raw) => {
      const marked = raw.includes(BULLET_MARK)
      const text = raw.replaceAll(BULLET_MARK, '').replace(/\s+/g, ' ').trim()
      const bullet = marked || BULLET.test(text)
      return { text: text.replace(BULLET, ''), bullet }
    })
    .filter((line) => line.text.length > 0)
}

/** Classify a line as a section heading: short, and not a finished sentence unless it ends in a colon. */
function headingOf(text: string): { section: Section | null; rest: string } | undefined {
  const [head, ...after] = text.split(':')
  const label = head.trim()
  const rest = after.join(':').trim()
  if (label.length > 90 || (!text.trimEnd().endsWith(':') && !rest && /[.!?]$/.test(label))) return undefined
  for (const [section, pattern] of HEADINGS) {
    if (pattern.test(label)) return { section, rest }
  }
  return undefined
}

/** Split a listing into its responsibilities, requirements and preferred items. */
export function describe(root: Element): JobDescription | undefined {
  const lines = toLines(root)
  const text = lines
    .map((l) => (l.bullet ? `• ${l.text}` : l.text))
    .join('\n')
    .slice(0, MAX_TEXT)
  if (text.length < 200) return undefined

  const found: Record<Section, Line[]> = { responsibilities: [], requirements: [], preferred: [] }
  let current: Section | null = null
  for (const line of lines) {
    const heading = line.bullet ? undefined : headingOf(line.text)
    if (heading) {
      current = heading.section
      if (current && heading.rest) found[current].push({ text: heading.rest, bullet: false })
      continue
    }
    if (!current) continue
    // Short unpunctuated lines inside a section are sub-headings such as "Team Introduction".
    if (!line.bullet && line.text.length <= 40 && !/[.!?]$/.test(line.text)) continue
    found[current].push(line)
  }

  // Listings often open a section with intro prose before the bullet list. When a
  // section has bullets, those are the items; otherwise its paragraphs are.
  const items = (section: Section) => {
    const all = found[section]
    const pick = all.some((l) => l.bullet) ? all.filter((l) => l.bullet) : all
    return pick.slice(0, MAX_ITEMS).map((l) => l.text.slice(0, 400))
  }

  return {
    responsibilities: items('responsibilities'),
    requirements: items('requirements'),
    preferred: items('preferred'),
    text,
    capturedAt: new Date().toISOString(),
  }
}

/**
 * Find the element holding a listing's description when no site-specific selector
 * applies: start at a section heading and climb until the element contains headings
 * of at least two different sections.
 */
export function findDescriptionRoot(doc: Document): Element | null {
  const headings: [Element, Section][] = []
  for (const el of doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, strong, b, span, div, dt')) {
    const own = el.textContent?.trim() ?? ''
    const section = own && own.length <= 90 ? headingOf(own)?.section : undefined
    if (section) headings.push([el, section])
  }
  for (const [start] of headings) {
    let el: Element | null = start
    for (let depth = 0; el && depth < 8; depth++, el = el.parentElement) {
      if ((el.textContent?.length ?? 0) > 60_000) break
      const kinds = new Set(headings.filter(([h]) => el!.contains(h)).map(([, s]) => s))
      if (kinds.size >= 2) return el
    }
  }
  return null
}

/** Parse the HTML string a JobPosting's JSON-LD description holds into an element. */
export function rootFromHtml(html: string): Element {
  let source = html
  // Some sites escape the HTML a second time inside the JSON.
  if (/&lt;\w/.test(source)) {
    source = new DOMParser().parseFromString(source, 'text/html').documentElement.textContent ?? ''
  }
  // A full document guarantees a <body> to return, whatever the fragment starts with.
  return new DOMParser().parseFromString(`<!doctype html><html><body>${source}</body></html>`, 'text/html').body
}
