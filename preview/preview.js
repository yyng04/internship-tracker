const stores = {
  applications: ['company', 'status', 'url', 'appliedAt', 'deadline', 'followUpAt', 'updatedAt', 'coverLetterId', 'resumeFileId', '*tags'],
  coverLetters: ['applicationId', 'templateId', 'updatedAt'],
  templates: ['name', 'updatedAt'],
  profile: [],
  files: ['kind', 'uploadedAt'],
  settings: [],
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('internship-tracker')
    request.onupgradeneeded = () => {
      const database = request.result
      for (const [name, indexes] of Object.entries(stores)) {
        const store = database.createObjectStore(name, { keyPath: 'id' })
        for (const index of indexes) {
          const multiEntry = index.startsWith('*')
          const field = multiEntry ? index.slice(1) : index
          store.createIndex(field, field, { multiEntry })
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function localDate(daysAgo = 0) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function timestamp(daysAgo = 0) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString()
}

function application(id, company, role, location, status, source, daysAgo, options = {}) {
  return {
    id, company, role, location, status, source,
    url: 'https://example.com/jobs/' + id,
    tags: options.tags || [],
    notes: options.notes || '',
    history: options.history || [{ at: timestamp(daysAgo), status }],
    createdAt: timestamp(daysAgo),
    updatedAt: timestamp(options.updatedAgo || 0),
    appliedAt: options.appliedAgo === undefined ? undefined : localDate(options.appliedAgo),
    deadline: options.deadlineAhead === undefined ? undefined : localDate(-options.deadlineAhead),
    followUpAt: options.followUpToday ? localDate() : undefined,
    coverLetterId: options.coverLetterId,
    salary: options.salary,
  }
}

async function seedPreview() {
  const pdf = await fetch('./sample-resume.pdf').then((response) => response.blob())
  const database = await openDatabase()
  const existingCount = await new Promise((resolve, reject) => {
    const request = database.transaction('applications').objectStore('applications').count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  if (existingCount > 0) {
    database.close()
    return
  }

  const applications = [
    application('stripe', 'Stripe', 'Software Engineering Intern', 'Singapore', 'applied', 'company', 12, {
      appliedAgo: 12, tags: ['engineering', 'payments'], notes: 'Submitted through the company careers site.',
      history: [{ at: timestamp(12), status: 'applied' }],
    }),
    application('canva', 'Canva', 'Product Design Intern', 'Remote · Singapore', 'interview', 'linkedin', 28, {
      appliedAgo: 26, followUpToday: true, coverLetterId: 'letter-canva',
      tags: ['design', 'remote'], notes: 'Portfolio review completed. Prepare questions for the design team.',
      history: [
        { at: timestamp(28), status: 'wishlist' },
        { at: timestamp(26), status: 'applied' },
        { at: timestamp(13), status: 'oa' },
        { at: timestamp(3), status: 'interview' },
      ],
    }),
    application('grab', 'Grab', 'Data Analyst Intern', 'Singapore', 'oa', 'indeed', 17, {
      appliedAgo: 17, deadlineAhead: 5, tags: ['data', 'analytics'],
      history: [{ at: timestamp(17), status: 'applied' }, { at: timestamp(6), status: 'oa' }],
    }),
    application('notion', 'Notion', 'UX Research Intern', 'Remote', 'rejected', 'company', 40, {
      appliedAgo: 40, tags: ['research'], history: [
        { at: timestamp(40), status: 'applied' },
        { at: timestamp(22), status: 'interview' },
        { at: timestamp(7), status: 'rejected' },
      ],
    }),
    application('figma', 'Figma', 'Design Systems Intern', 'San Francisco', 'wishlist', 'referral', 2, {
      deadlineAhead: 10, tags: ['design systems'], notes: 'Ask for a referral before applying.',
    }),
    application('airbnb', 'Airbnb', 'Product Intern', 'Singapore', 'offer', 'company', 54, {
      appliedAgo: 54, tags: ['product'], history: [
        { at: timestamp(54), status: 'applied' },
        { at: timestamp(31), status: 'interview' },
        { at: timestamp(5), status: 'offer' },
      ],
    }),
  ]

  const templates = [
    {
      id: 'template-general', name: 'Product and design',
      body: 'Dear {company} team,\n\nI am excited to apply for the {role} role. My projects in product design and research have taught me to turn ambiguous problems into clear, testable ideas.\n\nI would welcome the opportunity to contribute to {company}.\n\nBest,\n{name}',
      createdAt: timestamp(30), updatedAt: timestamp(8),
    },
    {
      id: 'template-engineering', name: 'Software engineering',
      body: 'Dear Hiring Team,\n\nI am applying for the {role} position at {company}. I enjoy building reliable software and learning from thoughtful engineering teams.\n\nSincerely,\n{name}',
      createdAt: timestamp(25), updatedAt: timestamp(12),
    },
  ]

  const letter = {
    id: 'letter-canva', applicationId: 'canva', templateId: 'template-general',
    title: 'Canva product design',
    body: 'Dear Canva team,\n\nI am excited to apply for the Product Design Intern role. I enjoy turning research into clear, accessible interfaces and collaborating with people across design and engineering.\n\nI would love to bring that curiosity to Canva.\n\nBest,\nAlex Tan',
    createdAt: timestamp(26), updatedAt: timestamp(4),
  }

  await new Promise((resolve, reject) => {
    const tx = database.transaction(Object.keys(stores), 'readwrite')
    for (const row of applications) tx.objectStore('applications').put(row)
    for (const row of templates) tx.objectStore('templates').put(row)
    tx.objectStore('coverLetters').put(letter)
    tx.objectStore('profile').put({
      id: 'me', fullName: 'Alex Tan', email: 'alex@example.com', phone: '+65 9000 0000',
      linkedin: 'https://linkedin.com/in/example', github: 'https://github.com/example',
      portfolio: 'https://example.com/portfolio', school: 'Example University',
      gradYear: '2027', bullets: [
        'Designed and tested a student application dashboard.',
        'Built accessible React components for a course project.',
      ],
    })
    tx.objectStore('files').put({
      id: 'sample-resume', name: 'Alex-Tan-Sample-Resume.pdf', mime: 'application/pdf',
      size: pdf.size, blob: pdf, kind: 'resume', uploadedAt: timestamp(2),
    })
    tx.objectStore('settings').put({ id: 'settings', reminderHour: 9, notificationsEnabled: true })
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  database.close()
}

const dashboard = document.getElementById('dashboard')
const popup = document.getElementById('popup')
const popupWrap = document.getElementById('popup-wrap')
const popupShade = document.getElementById('popup-shade')
const popupToggle = document.getElementById('popup-toggle')
const previewBuild = Date.now().toString()
function setRoute(route) {
  dashboard.src = './app/src/dashboard/index.html?v=' + previewBuild + '#' + route
}

function showPopup(show) {
  popupWrap.hidden = !show
  popupShade.hidden = !show
  popupToggle.textContent = show ? 'Hide capture popup' : 'Show capture popup'
  popupToggle.setAttribute('aria-expanded', String(show))
}

popupToggle.addEventListener('click', () => showPopup(popupWrap.hidden))
document.getElementById('popup-close').addEventListener('click', () => showPopup(false))
popupShade.addEventListener('click', () => showPopup(false))

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.data?.type !== 'preview-open-dashboard') return
  const hash = new URL(event.data.url).hash.slice(1) || '/board'
  setRoute(hash)
  showPopup(false)
})

seedPreview().then(() => {
  document.getElementById('loading').hidden = true
  document.getElementById('shell').hidden = false
  setRoute('/board')
  popup.src = './app/src/popup/index.html?v=' + previewBuild
}).catch((error) => {
  document.getElementById('loading').textContent = 'Could not prepare the preview: ' + error.message
})
