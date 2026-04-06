// ── Existing OpenAI helpers (unchanged) ──────────────────────────────────────

const OPENAI_BASE = 'https://api.openai.com/v1'

async function chat(messages, apiKey) {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 512 }),
  })
  if (!res.ok) throw new Error(`AI API error: ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content
}

export async function summarizeFile(filename, content, apiKey) {
  const truncated = content.slice(0, 3000)
  return chat(
    [
      { role: 'system', content: 'You are a code analyst. Be concise.' },
      { role: 'user', content: `Summarize this file in 2-3 sentences. File: ${filename}\n\n${truncated}` },
    ],
    apiKey
  )
}

export async function extractDependencies(filename, content, apiKey) {
  const truncated = content.slice(0, 3000)
  return chat(
    [
      { role: 'system', content: 'You are a code analyst. Reply with JSON only.' },
      { role: 'user', content: `List imports/dependencies as JSON array of strings. File: ${filename}\n\n${truncated}` },
    ],
    apiKey
  )
}

export async function summarizeRepo(repoInfo, fileTree, apiKey) {
  return chat(
    [
      { role: 'system', content: 'You are a code analyst. Be concise.' },
      {
        role: 'user',
        content: `Summarize this GitHub repo in 3-4 sentences.\nName: ${repoInfo.full_name}\nDescription: ${repoInfo.description}\nLanguage: ${repoInfo.language}\nStars: ${repoInfo.stargazers_count}\nFiles: ${fileTree.length}`,
      },
    ],
    apiKey
  )
}

// ── AWS SigV4 signing (Web Crypto — works in browser + Vite) ─────────────────

const enc = new TextEncoder()

function buf2hex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256hex(data) {
  return buf2hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data))
}

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, enc.encode(data))
}

async function signingKey(secret, date, region, service) {
  const kDate    = await hmac(`AWS4${secret}`, date)
  const kRegion  = await hmac(kDate, region)
  const kService = await hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

async function signV4({ method, url, body, service, region, accessKey, secretKey, sessionToken }) {
  const now    = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')   // 20250101T120000Z
  const dateStamp = amzDate.slice(0, 8)                             // 20250101

  const { host, pathname, search } = new URL(url)
  const bodyHash = await sha256hex(body)

  const headers = {
    'content-type': 'application/json',
    host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': bodyHash,
    ...(sessionToken ? { 'x-amz-security-token': sessionToken } : {}),
  }

  const signedHeaderNames = Object.keys(headers).sort().join(';')
  const canonicalHeaders  = Object.keys(headers).sort().map(k => `${k}:${headers[k]}`).join('\n') + '\n'
  const canonicalRequest  = [method, pathname, search.slice(1), canonicalHeaders, signedHeaderNames, bodyHash].join('\n')

  const credScope  = `${dateStamp}/${region}/${service}/aws4_request`
  const strToSign  = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${await sha256hex(canonicalRequest)}`
  const signature  = buf2hex(await hmac(await signingKey(secretKey, dateStamp, region, service), strToSign))

  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,
  }
}

// ── analyzeFile — Bedrock Converse API ───────────────────────────────────────

const MODEL_ID = 'us.anthropic.claude-sonnet-4-20250514-v1:0'

const FALLBACK = { summary: '', purpose: '', keyExports: [], complexity: 'low', suggestedNextFiles: [] }

function buildPrompt(filename, content, repoContext) {
  const truncated = content.slice(0, 3000)
  return `You are a code explanation assistant. Analyze this file from a GitHub repository.

Repository context: ${repoContext}
Filename: ${filename}

File content:
${truncated}

Respond in JSON format:
{
  "summary": "2-3 sentence plain English explanation of what this file does",
  "purpose": "one line - the single main job of this file",
  "keyExports": ["list", "of", "main", "exports"],
  "complexity": "low|medium|high",
  "suggestedNextFiles": ["files a new developer should read next"]
}`
}

function parseJson(text) {
  // Strip optional ```json … ``` fences Claude sometimes adds
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    return { ...FALLBACK, ...JSON.parse(cleaned) }
  } catch {
    return { ...FALLBACK, summary: text.trim() }
  }
}

export async function analyzeFile(filename, content, repoContext = '') {
  const region      = import.meta.env.VITE_AWS_REGION      || 'us-east-1'
  const accessKey   = import.meta.env.VITE_AWS_ACCESS_KEY_ID
  const secretKey   = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY
  const sessionToken = import.meta.env.VITE_AWS_SESSION_TOKEN || ''

  if (!accessKey || !secretKey) throw new Error('AWS credentials not configured (VITE_AWS_ACCESS_KEY_ID / VITE_AWS_SECRET_ACCESS_KEY)')

  const url  = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(MODEL_ID)}/converse`
  const body = JSON.stringify({
    messages: [{ role: 'user', content: [{ text: buildPrompt(filename, content, repoContext) }] }],
    inferenceConfig: { maxTokens: 1024, temperature: 0.2 },
  })

  const signedHeaders = await signV4({ method: 'POST', url, body, service: 'bedrock', region, accessKey, secretKey, sessionToken })

  const res = await fetch(url, { method: 'POST', headers: signedHeaders, body })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Bedrock error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data?.output?.message?.content?.[0]?.text ?? ''
  return parseJson(text)
}
