import { meta, text, type SiteExtractor } from './types'

function companyFromHost(hostname: string): string {
  const host = hostname.replace(/^www\./, '').split('.')[0].toLowerCase()
  const known: Record<string, string> = {
    lifeattiktok: 'TikTok',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
    indeed: 'Indeed',
    glassdoor: 'Glassdoor',
  }
  return known[host] ?? host.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
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

/** Fallback for company career pages: JSON-LD JobPosting, then og tags, then title. */
export const generic: SiteExtractor = {
  matches: () => true,
  extract: () => {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent ?? '')
        const items = Array.isArray(data) ? data : [data]
        for (const it of items) {
          if (it?.['@type'] === 'JobPosting') {
            const addr = it.jobLocation?.address ?? it.jobLocation?.[0]?.address
            return {
              source: 'company',
              title: it.title ?? '',
              company: it.hiringOrganization?.name ?? '',
              location: [addr?.addressLocality, addr?.addressCountry].filter(Boolean).join(', '),
            }
          }
        }
      } catch {
        // ignore malformed JSON-LD
      }
    }
    const ogTitle = meta('og:title') || document.title
    // "Software Intern - Acme" or "Software Intern | Acme" or "Software Intern at Acme"
    const m = ogTitle.match(/^(.*?)\s+(?:-|\||at|@|·)\s+(.*)$/i)
    const hostCompany = companyFromHost(location.hostname)
    return {
      source: 'company',
      title: (m ? m[1] : ogTitle).trim() || text('h1'),
      company: (m ? m[2] : meta('og:site_name') || hostCompany).trim(),
      location: labeledValue('Location'),
    }
  },
}
