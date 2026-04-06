// Shared service logic — no import/export (loaded as plain script in extension context)

// ── GitHub ────────────────────────────────────────────────────────────────────

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
  const map = { '': root }
  const sorted = [...data.tree].sort((a, b) => a.path.localeCompare(b.path))

  for (const item of sorted) {
    const parts = item.path.split('/')
    const name = parts[parts.length - 1]
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

// ── AWS SigV4 (Web Crypto) ────────────────────────────────────────────────────

const _enc = new TextEncoder()
const _buf2hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
const _sha256  = async d => _buf2hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? _enc.encode(d) : d))
const _hmac    = async (key, data) => {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? _enc.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, _enc.encode(data))
}

async function _signingKey(secret, date, region, service) {
  return _hmac(await _hmac(await _hmac(await _hmac(`AWS4${secret}`, date), region), service), 'aws4_request')
}

async function _signV4({ method, url, body, region, accessKey, secretKey, sessionToken }) {
  const now       = new Date()
  const amzDate   = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const { host, pathname, search } = new URL(url)
  const bodyHash  = await _sha256(body)
  const headers   = {
    'content-type': 'application/json', host,
    'x-amz-date': amzDate, 'x-amz-content-sha256': bodyHash,
    ...(sessionToken ? { 'x-amz-security-token': sessionToken } : {}),
  }
  const signedNames    = Object.keys(headers).sort().join(';')
  const canonHeaders   = Object.keys(headers).sort().map(k => `${k}:${headers[k]}`).join('\n') + '\n'
  const canonRequest   = [method, pathname, search.slice(1), canonHeaders, signedNames, bodyHash].join('\n')
  const credScope      = `${dateStamp}/${region}/bedrock/aws4_request`
  const strToSign      = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${await _sha256(canonRequest)}`
  const signature      = _buf2hex(await _hmac(await _signingKey(secretKey, dateStamp, region, 'bedrock'), strToSign))
  return { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedNames}, Signature=${signature}` }
}

// ── Bedrock analyzeFile ───────────────────────────────────────────────────────

const BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-20250514-v1:0'
const AI_FALLBACK   = { summary: '', purpose: '', keyExports: [], complexity: 'low', suggestedNextFiles: [] }

function _buildPrompt(filename, content, repoContext) {
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

function _parseAiJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return { ...AI_FALLBACK, ...JSON.parse(cleaned) } }
  catch { return { ...AI_FALLBACK, summary: text.trim() } }
}

async function analyzeFile(filename, content, repoContext, creds) {
  const { accessKey, secretKey, sessionToken = '', region = 'us-east-1' } = creds
  if (!accessKey || !secretKey) throw new Error('AWS credentials not configured')
  const url  = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(BEDROCK_MODEL)}/converse`
  const body = JSON.stringify({
    messages: [{ role: 'user', content: [{ text: _buildPrompt(filename, content, repoContext) }] }],
    inferenceConfig: { maxTokens: 1024, temperature: 0.2 },
  })
  const signedHeaders = await _signV4({ method: 'POST', url, body, region, accessKey, secretKey, sessionToken })
  const res = await fetch(url, { method: 'POST', headers: signedHeaders, body })
  if (!res.ok) throw new Error(`Bedrock error ${res.status}: ${await res.text().catch(() => res.statusText)}`)
  const data = await res.json()
  return _parseAiJson(data?.output?.message?.content?.[0]?.text ?? '')
}
