// background.js — MV3 service worker
importScripts('services.js')

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PING') { sendResponse({ pong: true }); return }
  handleMessage(msg)
    .then(sendResponse)
    .catch(e => sendResponse({ error: e.message }))
  return true
})

function getCredentials() {
  return new Promise(resolve =>
    chrome.storage.sync.get(['githubToken', 'groqApiKey'], resolve)
  )
}

async function handleMessage(msg) {
  const creds = await getCredentials()
  const token      = creds.githubToken || ''
  const groqApiKey = creds.groqApiKey  || ''

  switch (msg.type) {
    case 'FETCH_REPO_INFO':
      return fetchRepoInfo(msg.owner, msg.repo, token)
    case 'FETCH_FILE_TREE':
      return fetchFileTree(msg.owner, msg.repo, token)
    case 'FETCH_FILE_CONTENT':
      return fetchFileContent(msg.owner, msg.repo, msg.path, token)
    case 'ANALYZE_FILE':
      return analyzeFile(msg.filename, msg.content, msg.repoContext, groqApiKey)
    default:
      throw new Error(`Unknown message type: ${msg.type}`)
  }
}
