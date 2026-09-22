import type { CapturedJob } from '../../types'

export interface SiteExtractor {
  /** Return true when this extractor should handle the current page. */
  matches(url: URL): boolean
  extract(): Partial<CapturedJob>
}

export const text = (sel: string, root: ParentNode = document): string =>
  root.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

export const meta = (name: string): string =>
  (document.querySelector(`meta[property="${name}"], meta[name="${name}"]`) as HTMLMetaElement | null)
    ?.content?.trim() ?? ''
