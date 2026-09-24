// This local preview supplies only the browser APIs used by the popup and dashboard.
const exampleJob = {
  title: 'Product Design Intern (TikTok-Design)-2027 Start',
  company: 'TikTok',
  location: 'Singapore',
  url: 'https://lifeattiktok.com/search/7667858938939853109',
  source: 'company',
}

globalThis.chrome = {
  tabs: {
    query: async () => [{ id: 1, url: exampleJob.url, title: exampleJob.title }],
    sendMessage: async () => exampleJob,
    create: ({ url }) => parent.postMessage({ type: 'preview-open-dashboard', url }, location.origin),
  },
  runtime: {
    sendMessage: async () => true,
    getManifest: () => ({ version: '0.1.0 preview' }),
    getURL: (path) => new URL('/app/' + path, location.origin).href,
  },
  notifications: {
    create: async () => { throw new Error('System notifications are unavailable in the local preview') },
  },
}
