import { text, type SiteExtractor } from './types'

export const glassdoor: SiteExtractor = {
  matches: (u) => u.hostname.includes('glassdoor.'),
  extract: () => ({
    source: 'glassdoor',
    title: text('[data-test="job-title"]') || text('h1'),
    company: text('[data-test="employer-name"]') || text('[data-test="employerName"]'),
    location: text('[data-test="location"]'),
  }),
}
