import type { CapturedJob } from '../../types'

export interface SiteExtractor {
  /** Return true when this extractor should handle the current page. */
  matches(url: URL): boolean
  extract(): Partial<CapturedJob>
  /** The element holding the listing's description, when the site has a known container. */
  descriptionRoot?(): Element | null
}

/** First element matching any of the selectors, in order. */
export const first = (...selectors: string[]): Element | null => {
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el) return el
  }
  return null
}

export const text = (sel: string, root: ParentNode = document): string =>
  root.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

export const meta = (name: string): string =>
  (document.querySelector(`meta[property="${name}"], meta[name="${name}"]`) as HTMLMetaElement | null)
    ?.content?.trim() ?? ''
