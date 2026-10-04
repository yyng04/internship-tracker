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
