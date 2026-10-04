const DASHBOARD = 'src/dashboard/index.html'

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'open-dashboard') chrome.tabs.create({ url: chrome.runtime.getURL(DASHBOARD) })
})
