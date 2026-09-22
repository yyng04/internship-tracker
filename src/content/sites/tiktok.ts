import { meta, text, type SiteExtractor } from './types'

/** The Life at TikTok job pages label the location beside the role heading. */
export const tiktok: SiteExtractor = {
  matches: (url) => url.hostname === 'lifeattiktok.com' || url.hostname.endsWith('.lifeattiktok.com'),
  extract: () => {
    const label = [...document.querySelectorAll('p')].find(
      (node) => node.textContent?.trim().replace(/\s+/g, ' ') === 'Location:',
    )

    const location = label?.nextElementSibling?.textContent?.trim()
      || label?.parentElement?.textContent?.replace(/^Location:\s*/i, '').trim()
      || ''
    return {
      source: 'company',
      title: text('h2') || meta('og:title') || document.title,
      company: 'TikTok',
      location,
    }
  },
}
