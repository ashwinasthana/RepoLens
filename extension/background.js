// background.js — MV3 service worker
importScripts('services.js')

// Keep the service worker alive by responding to a ping from sidebar.js
// MV3 service workers can be suspended; the first message after suspension
// would otherwise be silently dropped.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PING') { sendResponse({ pong: true }); return }
  handleMessage(msg)
    .then(sendResponse)
    .catch(e => sendResponse({ error: e.message }))
  return true  // keep message channel open for async response
})

function getCredentials() {
  return new Promise(resolve =>
    chrome.storage.sync.get(
      ['githubToken', 'awsAccessKey', 'awsSecretKey', 'awsSessionToken', 'awsRegion'],
      resolve
    )
  )
}

async function handleMessage(msg) {
  const creds = await getCredentials()
  const token = creds.githubToken || ''
  const awsCreds = {
    accessKey:    creds.awsAccessKey    || '',
    secretKey:    creds.awsSecretKey    || '',
    sessionToken: creds.awsSessionToken || '',
    region:       creds.awsRegion       || 'us-east-1',
  }

  switch (msg.type) {
    case 'FETCH_REPO_INFO':
      return fetchRepoInfo(msg.owner, msg.repo, token)
    case 'FETCH_FILE_TREE':
      return fetchFileTree(msg.owner, msg.repo, token)
    case 'FETCH_FILE_CONTENT':
      return fetchFileContent(msg.owner, msg.repo, msg.path, token)
    case 'ANALYZE_FILE':
      return analyzeFile(msg.filename, msg.content, msg.repoContext, awsCreds)
    default:
      throw new Error(`Unknown message type: ${msg.type}`)
  }
}
