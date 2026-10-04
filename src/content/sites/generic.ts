import { rootFromHtml } from '../description'
import { meta, text, type SiteExtractor } from './types'

// Applicant tracking systems put the hiring company in the path or subdomain.
const BOARD_IN_PATH = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com)$/
const BOARD_IN_SUBDOMAIN = /\.myworkdayjobs\.com$/
const GENERIC_LABEL = /^(www|careers?|jobs?|apply|boards|job-boards|en)$/

function companyFromUrl(url: URL): string {
  const host = url.hostname.toLowerCase()
  let name: string
  if (BOARD_IN_PATH.test(host)) name = url.pathname.split('/').filter(Boolean)[0] ?? ''
  else if (BOARD_IN_SUBDOMAIN.test(host)) name = host.split('.')[0]
  else name = host.split('.').find((label) => !GENERIC_LABEL.test(label)) ?? host
  const known: Record<string, string> = {
    lifeattiktok: 'TikTok',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
    indeed: 'Indeed',
    glassdoor: 'Glassdoor',
  }
  return known[name] ?? name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function labeledValue(label: string): string {
  const marker = [...document.querySelectorAll('p, dt, span, div')].find(
    (node) => node.textContent?.trim().replace(/\s+/g, ' ') === `${label}:`,
  )
  const sibling = marker?.nextElementSibling?.textContent?.trim()
  if (sibling) return sibling
  const parentText = marker?.parentElement?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  return parentText.replace(new RegExp(`^${label}:\\s*`, 'i'), '').trim()
}

// Shape of the schema.org JobPosting fields this extension reads.
interface JobPosting {
  title?: string
  description?: string
  hiringOrganization?: { name?: string }
  jobLocation?: { address?: Address } | { address?: Address }[]
}
interface Address {
  addressLocality?: string
  addressCountry?: string
}

/** The page's schema.org JobPosting, which many career sites embed as JSON-LD. */
function jobPosting(): JobPosting | undefined {
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.textContent ?? '')
      const items = Array.isArray(data) ? data : (data?.['@graph'] ?? [data])
      const found = items.find((it: { '@type'?: string }) => it?.['@type'] === 'JobPosting')
      if (found) return found
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return undefined
}

/** Fallback for company career pages: JSON-LD JobPosting, then og tags, then title. */
export const generic: SiteExtractor = {
  matches: () => true,
  descriptionRoot: () => {
    const html = jobPosting()?.description
    return html ? rootFromHtml(html) : null
  },
  extract: () => {
    const it = jobPosting()
    if (it) {
      const loc = Array.isArray(it.jobLocation) ? it.jobLocation[0] : it.jobLocation
      const addr = loc?.address
      return {
        source: 'company',
        title: it.title ?? '',
        company: it.hiringOrganization?.name ?? '',
        location: [addr?.addressLocality, addr?.addressCountry].filter(Boolean).join(', '),
      }
    }
    const ogTitle = meta('og:title') || document.title
    // "Software Intern - Acme" or "Software Intern | Acme" or "Software Intern at Acme"
    const m = ogTitle.match(/^(.*?)\s+(?:-|\||at|@|·)\s+(.*)$/i)
    const hostCompany = companyFromUrl(new URL(location.href))
    return {
      source: 'company',
      title: (m ? m[1] : ogTitle).trim() || text('h1'),
      company: (m ? m[2] : meta('og:site_name') || hostCompany).trim(),
      location: labeledValue('Location'),
    }
  },
}
