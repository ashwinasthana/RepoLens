// background.js — MV3 service worker (services.js inlined — no importScripts)

// ── GitHub helpers ────────────────────────────────────────────────────────────

const GH_BASE = 'https://api.github.com'

function parseGithubUrl(url) {
  let parsed
  try { parsed = new URL(url) } catch { throw new Error('Invalid URL') }
  if (parsed.hostname !== 'github.com') throw new Error('URL must be from github.com')
  const parts = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/')
  if (parts.length < 2 || !parts[0] || !parts[1]) throw new Error('URL must be github.com/owner/repo')
  return { owner: parts[0], repo: parts[1] }
}

async function ghFetch(path, token) {
  if (!path.startsWith('/')) throw new Error('Invalid API path')
  const headers = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${GH_BASE}${path}`, { headers })
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${res.statusText}`)
  return res.json()
}

async function fetchRepoInfo(owner, repo, token) {
  return ghFetch(`/repos/${owner}/${repo}`, token)
}

async function fetchFileTree(owner, repo, token) {
  const data = await ghFetch(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, token)
  if (data.truncated) console.warn('RepoLens: tree truncated')
  const root = { name: repo, path: '', type: 'tree', children: [] }
  const map  = { '': root }
  const sorted = [...data.tree].sort((a, b) => a.path.localeCompare(b.path))
  for (const item of sorted) {
    const parts      = item.path.split('/')
    const name       = parts[parts.length - 1]
    const parentPath = parts.slice(0, -1).join('/')
    const node = { name, path: item.path, type: item.type, children: item.type === 'tree' ? [] : undefined }
    map[item.path] = node
    ;(map[parentPath] ?? root).children.push(node)
  }
  return root
}

async function fetchFileContent(owner, repo, path, token) {
  const data = await ghFetch(`/repos/${owner}/${repo}/contents/${path}`, token)
  if (data.encoding !== 'base64') throw new Error(`Unexpected encoding: ${data.encoding}`)
  return atob(data.content.replace(/\n/g, ''))
}

// ── Groq AI ───────────────────────────────────────────────────────────────────

const GROQ_MODEL  = 'llama-3.3-70b-versatile'
const AI_FALLBACK = { summary: '', purpose: '', keyExports: [], complexity: 'low', suggestedNextFiles: [] }

function buildPrompt(filename, content, repoContext) {
  return `You are a code explanation assistant. Analyze this file from a GitHub repository.

Repository context: ${repoContext}
Filename: ${filename}

File content:
${content.slice(0, 3000)}

Respond in JSON format:
{
  "summary": "2-3 sentence plain English explanation of what this file does",
  "purpose": "one line - the single main job of this file",
  "keyExports": ["list", "of", "main", "exports"],
  "complexity": "low|medium|high",
  "suggestedNextFiles": ["files a new developer should read next"]
}`
}

function parseAiJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return { ...AI_FALLBACK, ...JSON.parse(cleaned) } }
  catch { return { ...AI_FALLBACK, summary: text.trim() } }
}

async function analyzeFile(filename, content, repoContext, groqApiKey) {
  if (!groqApiKey) throw new Error('Groq API key not configured — run chrome.storage.sync.set({groqApiKey:"..."})')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqApiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are a code analyst. Always respond with valid JSON only, no markdown fences.' },
        { role: 'user',   content: buildPrompt(filename, content, repoContext) },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    }),
  })
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text().catch(() => res.statusText)}`)
  const data = await res.json()
  return parseAiJson(data.choices[0].message.content)
}

// ── Message handler ───────────────────────────────────────────────────────────

function getCredentials() {
  return new Promise(resolve =>
    chrome.storage.sync.get(['githubToken', 'groqApiKey'], resolve)
  )
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PING') { sendResponse({ pong: true }); return }
  handleMessage(msg)
    .then(sendResponse)
    .catch(e => sendResponse({ error: e.message }))
  return true
})

async function handleMessage(msg) {
  const creds      = await getCredentials()
  const token      = creds.githubToken || ''
  const groqApiKey = creds.groqApiKey  || ''

  switch (msg.type) {
    case 'FETCH_REPO_INFO':    return fetchRepoInfo(msg.owner, msg.repo, token)
    case 'FETCH_FILE_TREE':    return fetchFileTree(msg.owner, msg.repo, token)
    case 'FETCH_FILE_CONTENT': return fetchFileContent(msg.owner, msg.repo, msg.path, token)
    case 'ANALYZE_FILE':       return analyzeFile(msg.filename, msg.content, msg.repoContext, groqApiKey)
    default: throw new Error(`Unknown message type: ${msg.type}`)
  }
}
