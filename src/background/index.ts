import { db } from '../db/schema'
import { getSettings, listDue } from '../db/repo'

const ALARM = 'daily-reminder'
const DASHBOARD = 'src/dashboard/index.html'

async function updateBadge() {
  const due = await listDue()
  const n = due.length
  await chrome.action.setBadgeText({ text: n ? String(n) : '' })
  await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' })
  return due
}

async function scheduleAlarm() {
  const { reminderHour } = await getSettings()
  const next = new Date()
  next.setHours(reminderHour, 0, 0, 0)
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1)
  await chrome.alarms.clear(ALARM)
  await chrome.alarms.create(ALARM, { when: next.getTime(), periodInMinutes: 24 * 60 })
}

async function notifyDue() {
  const due = await updateBadge()
  const { notificationsEnabled } = await getSettings()
  if (!notificationsEnabled || due.length === 0) return
  const lines = due.slice(0, 4).map((a) => `${a.company}: ${a.role}`)
  if (due.length > 4) lines.push(`and ${due.length - 4} more`)
  chrome.notifications.create('due-today', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: `${due.length} application${due.length === 1 ? '' : 's'} need attention`,
    message: lines.join('\n'),
    priority: 1,
  })
}

function openDashboard(hash = '') {
  chrome.tabs.create({ url: chrome.runtime.getURL(DASHBOARD) + (hash ? `#${hash}` : '') })
}

chrome.runtime.onInstalled.addListener(async () => {
  await db.open()
  await scheduleAlarm()
  await updateBadge()
})

chrome.runtime.onStartup.addListener(async () => {
  await scheduleAlarm()
  await updateBadge()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void notifyDue()
})

chrome.notifications.onClicked.addListener((id) => {
  if (id === 'due-today') {
    chrome.notifications.clear(id)
    openDashboard('/board?filter=due')
  }
})

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'open-dashboard') openDashboard()
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'DATA_CHANGED') {
    void scheduleAlarm().then(updateBadge).then(() => sendResponse(true))
    return true
  }
  if (msg?.type === 'OPEN_DASHBOARD') {
    openDashboard(msg.hash)
    sendResponse(true)
  }
  return false
})
