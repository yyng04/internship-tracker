const DASHBOARD = 'src/dashboard/index.html'

function openDashboard(hash = '') {
  chrome.tabs.create({ url: chrome.runtime.getURL(DASHBOARD) + (hash ? `#${hash}` : '') })
}

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'open-dashboard') openDashboard()
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'OPEN_DASHBOARD') {
    openDashboard(msg.hash)
    sendResponse(true)
  }
  return false
})
