// background.js — MV3 service worker
// All network calls go through here so they run in the extension origin (no CORS issues)

importScripts('services.js')

function getCredentials() {
  return new Promise(resolve =>
    chrome.storage.sync.get(['githubToken', 'awsAccessKey', 'awsSecretKey', 'awsSessionToken', 'awsRegion'], resolve)
  )
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse).catch(e => sendResponse({ error: e.message }))
  return true  // keep channel open for async response
})

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
