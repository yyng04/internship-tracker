// This local preview supplies only the browser APIs used by the popup and dashboard.
const exampleJob = {
  title: 'Product Design Intern (TikTok-Design)-2027 Start',
  company: 'TikTok',
  location: 'Singapore',
  url: 'https://lifeattiktok.com/search/7667858938939853109',
  source: 'company',
  description: {
    responsibilities: ['Design flows for a new creator tool', 'Prototype and test interactions with users'],
    requirements: ['Currently pursuing a degree in design or a related field', 'A portfolio of product design work'],
    preferred: ['Prototyping with code'],
    text: 'Sample listing used by the local preview.',
    capturedAt: new Date().toISOString(),
  },
}

// Add ?search to the popup's address to see how it handles a search results page.
if (new URLSearchParams(location.search).has('search')) {
  Object.assign(exampleJob, {
    title: '75+ Summer Internship 2027 Jobs, Employment',
    company: '',
    url: 'https://sg.indeed.com/q-summer-internship-2027-jobs.html',
    description: undefined,
    looksLikeSearch: true,
  })
}

globalThis.chrome = {
  tabs: {
    query: async () => [{ id: 1, url: exampleJob.url, title: exampleJob.title }],
    sendMessage: async () => exampleJob,
    create: ({ url }) => parent.postMessage({ type: 'preview-open-dashboard', url }, location.origin),
  },
  scripting: {
    executeScript: async () => [],
  },
  runtime: {
    sendMessage: async () => true,
    getManifest: () => ({ version: '0.1.0 preview' }),
    getURL: (path) => new URL('/app/' + path, location.origin).href,
  },
}

// The preview records print requests instead of opening the browser's print dialog.
window.print = () => {
  window.__printCalls = (window.__printCalls || 0) + 1
}
