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

const GROQ_MODEL  = 'llama-3.1-8b-instant'
const AI_FALLBACK = { summary: '', purpose: '', keyExports: [], complexity: 'low', suggestedNextFiles: [] }
const GROQ_MAX_RETRIES = 3
const GROQ_REQUEST_TIMEOUT_MS = 45000

let groqQueue = Promise.resolve()

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function enqueueGroq(task) {
  const run = groqQueue.then(task, task)
  groqQueue = run.catch(() => undefined)
  return run
}

function parseRetryDelayMs(response, responseText) {
  const retryAfterHeader = Number(response.headers.get('retry-after'))
  if (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0) {
    return Math.ceil(retryAfterHeader * 1000)
  }

  const match = /try again in\s*([\d.]+)s/i.exec(responseText || '')
  if (match) {
    const seconds = Number(match[1])
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000)
  }

  return 12000
}

async function groqChatCompletion(groqApiKey, body) {
  if (!groqApiKey) throw new Error('Groq API key not configured')

  let attempt = 0
  while (attempt <= GROQ_MAX_RETRIES) {
    let responsePayload
    try {
      responsePayload = await enqueueGroq(async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), GROQ_REQUEST_TIMEOUT_MS)
        let res
        try {
          res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqApiKey}` },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timeoutId)
        }
        const text = await res.text().catch(() => res.statusText)
        return { res, text }
      })
    } catch (err) {
      const isAbort = err?.name === 'AbortError'
      if (isAbort && attempt < GROQ_MAX_RETRIES) {
        attempt += 1
        continue
      }
      if (isAbort) {
        throw new Error('Groq request timed out. Please retry in a few seconds.')
      }
      throw err
    }

    const { res, text } = responsePayload

    if (res.ok) {
      try { return JSON.parse(text) }
      catch { throw new Error('Groq response parsing failed') }
    }

    if (res.status === 429 && attempt < GROQ_MAX_RETRIES) {
      const waitMs = parseRetryDelayMs(res, text) + attempt * 1200
      await sleep(waitMs)
      attempt += 1
      continue
    }

    throw new Error(`Groq error ${res.status}: ${text}`)
  }

  throw new Error('Groq rate limit retries exhausted. Please try again in a moment.')
}

function buildPrompt(filename, content, repoContext) {
  return `You are a code explanation assistant. Analyze this file from a GitHub repository.

Repository context: ${repoContext}
Filename: ${filename}

File content:
${content.slice(0, 1200)}

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

async function analyzeFile(filename, content) {
  // 1. Try Groq FIRST (rich responses, always works)
  try {
    const { groqApiKey } = await chrome.storage.sync.get('groqApiKey');
    if (groqApiKey) {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + groqApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [{
              role: "user",
              content: "Explain this code in 2 sentences: " + content.slice(0, 1000)
            }],
            max_tokens: 200
          })
        }
      );
      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        console.log("✅ Using Groq (Primary)");
        return { summary: data.choices[0].message.content };
      }
    }
  } catch (err) {
    console.log("Groq failed, falling back to HF:", err);
  }

  // 2. Fall back to HF model if Groq fails
  try {
    const { hfToken } = await chrome.storage.sync.get('hfToken');
    if (hfToken) {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/ashwinasthana/repolens-model",
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + hfToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            inputs: "explain code: " + content.slice(0, 500)
          })
        }
      );
      const result = await response.json();
      if (Array.isArray(result) && result[0]?.generated_text) {
        console.log("✅ Using RepoLens custom model (Fallback)");
        return { summary: result[0].generated_text };
      }
    }
  } catch (err) {
    console.log("HF fallback failed:", err);
  }

  return { summary: "Analysis unavailable." };
}

async function groqAsk(groqApiKey, filename, content, instruction) {
  if (!groqApiKey) throw new Error('Groq API key not configured')
  const data = await groqChatCompletion(groqApiKey, {
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: 'You are an expert code analyst. Be thorough, specific, and practical.' },
      { role: 'user',   content: `${instruction}\n\nFilename: ${filename}\n\nFile content:\n${content.slice(0, 1200)}` },
    ],
    temperature: 0.3,
    max_tokens: 450,
  })
  return data.choices[0].message.content
}

// ── Message handler ───────────────────────────────────────────────────────────

function getCredentials() {
  return new Promise(resolve =>
    chrome.storage.sync.get(['githubToken', 'groqApiKey'], res => {
      resolve({
        githubToken: res.githubToken || '',
        groqApiKey: res.groqApiKey || ''
      })
    })
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
  if (!msg || typeof msg !== 'object') {
    throw new Error('Invalid message payload')
  }

  const creds      = await getCredentials()
  const token      = creds.githubToken || ''
  const groqApiKey = creds.groqApiKey  || ''
  const rawType = typeof msg.type === 'string' ? msg.type : ''
  const normalizedType = rawType.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '')
  const type = normalizedType === 'CHAT' ? 'CHAT_REPO' : normalizedType

  switch (type) {
    case 'FETCH_REPO_INFO':    return fetchRepoInfo(msg.owner, msg.repo, token)
    case 'FETCH_FILE_TREE':    return fetchFileTree(msg.owner, msg.repo, token)
    case 'FETCH_FILE_CONTENT': return fetchFileContent(msg.owner, msg.repo, msg.path, token)
    case 'ANALYZE_FILE':       return analyzeFile(msg.filename, msg.content, msg.repoContext, groqApiKey)
    case 'EXPLAIN_FILE':       return groqAsk(groqApiKey, msg.filename, msg.content,
      `Explain this file in detail for a developer new to the codebase. Go section by section, explain what each function/class does, why it exists, and how it connects to the rest of the system. Use plain English. Format with clear headings using \n\n## Heading\n.`)
    case 'GRAPH_FILE':         return groqAsk(groqApiKey, msg.filename, msg.content,
      `Analyze the dependency relationships in this file. Describe: 1) what this file imports and why, 2) what other files likely import this file, 3) where this file sits in the overall architecture. Be specific.`)
    case 'DEFS_FILE':          return groqAsk(groqApiKey, msg.filename, msg.content,
      `List and explain every exported function, class, constant, and type in this file. For each one: name, what it does, parameters/return value if applicable. Format clearly with each definition on its own line.`)
    case 'ONBOARD_FILE':       return groqAsk(groqApiKey, msg.filename, msg.content,
      `Write an onboarding guide for a new developer reading this file for the first time. Cover: 1) what problem this file solves, 2) key concepts they need to understand, 3) how to modify it safely, 4) common pitfalls. Be practical and specific.`)
    case 'CHAT_REPO':          return groqAsk(groqApiKey, msg.question, msg.context,
      `Answer the user's question about the repository using the provided context. Be practical, concise, and helpful.`)
    default: throw new Error(`Unknown message type: ${rawType || '(missing)'}`)
  }
}
