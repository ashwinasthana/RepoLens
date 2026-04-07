const GROQ_BASE = 'https://api.groq.com/openai/v1'
const GROQ_MODEL = 'llama-3.1-8b-instant'
const GROQ_MAX_RETRIES = 4

const FALLBACK = { summary: '', purpose: '', keyExports: [], complexity: 'low', suggestedNextFiles: [] }

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
  const retryAfter = response.headers.get('retry-after')
  if (retryAfter) {
    const asNumber = Number(retryAfter)
    if (Number.isFinite(asNumber) && asNumber > 0) return Math.ceil(asNumber * 1000)

    const asDate = Date.parse(retryAfter)
    if (!Number.isNaN(asDate)) {
      const diff = asDate - Date.now()
      if (diff > 0) return diff
    }
  }

  const waitMatch = /try again in\s*([\d.]+)\s*(ms|s)/i.exec(responseText || '')
  if (waitMatch) {
    const value = Number(waitMatch[1])
    if (Number.isFinite(value) && value > 0) {
      return waitMatch[2].toLowerCase() === 'ms' ? Math.ceil(value) : Math.ceil(value * 1000)
    }
  }

  return 10000
}

// ── Shared fetch helper ───────────────────────────────────────────────────────
export function getGroqApiKey() {
  return localStorage.getItem('repolens_groq_api_key') || import.meta.env.VITE_GROQ_API_KEY || ''
}

export function saveGroqApiKey(key) {
  if (key) localStorage.setItem('repolens_groq_api_key', key)
  else localStorage.removeItem('repolens_groq_api_key')
}

async function groqChat(messages, maxTokens = 1024) {
  const apiKey = getGroqApiKey()
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY is not set')

  let attempt = 0

  while (attempt <= GROQ_MAX_RETRIES) {
    const { res, text } = await enqueueGroq(async () => {
      const res = await fetch(`${GROQ_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.2, max_tokens: maxTokens }),
      })
      const text = await res.text().catch(() => res.statusText)
      return { res, text }
    })

    if (res.ok) {
      let data
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error('Groq returned invalid JSON response')
      }
      return data.choices[0].message.content
    }

    if (res.status === 429 && attempt < GROQ_MAX_RETRIES) {
      const waitMs = parseRetryDelayMs(res, text) + attempt * 800
      await sleep(waitMs)
      attempt += 1
      continue
    }

    throw new Error(`Groq error ${res.status}: ${text}`)
  }

  throw new Error('Groq rate limit retries exhausted. Please retry in a few seconds.')
}

// ── JSON parser ───────────────────────────────────────────────────────────────

function parseJson(text, fallback = {}) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return { ...fallback, ...JSON.parse(cleaned) } }
  catch { return { ...fallback, summary: text.trim() } }
}

// ── 1. File Analysis (Summary tab) ────────────────────────────────────────────
export async function analyzeFile(filename, content, repoContext = '') {
  const groqApiKey = getGroqApiKey()
  const hfToken = localStorage.getItem('repolens_hf_token')

  // 1. Try Groq
  if (groqApiKey) {
    try {
      const text = await groqChat([
        { role: 'system', content: 'You are a code analyst. Respond with valid JSON only.' },
        { 
          role: 'user', 
          content: `Analyze this file from a GitHub repository.\nFilename: ${filename}\nContent:\n${content.slice(0, 1500)}\n\nRespond in JSON:\n{ "summary": "2 sentence explanation", "purpose": "main job", "keyExports": [], "complexity": "low|medium|high", "suggestedNextFiles": [] }` 
        },
      ], 400)
      return parseJson(text, FALLBACK)
    } catch (err) {
      console.log("Groq web failed, falling back to HF:", err)
    }
  }

  // 2. Try HF Fallback
  if (hfToken) {
    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/ashwinasthana/repolens-model",
        {
          method: "POST",
          headers: { "Authorization": "Bearer " + hfToken, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: "explain code: " + content.slice(0, 800) })
        }
      )
      const result = await response.json()
      const summaryText = Array.isArray(result) ? result[0]?.generated_text : result?.generated_text
      if (summaryText) {
        return { ...FALLBACK, summary: summaryText }
      }
    } catch (err) {
      console.log("HF web fallback failed:", err)
    }
  }

  return { ...FALLBACK, summary: "Analysis unavailable. Please check your API Engine Token." }
}

// ── 2. Repo Summary ──────────────────────────────────────────────────────────

export async function summarizeRepo(repoInfo) {
  const text = await groqChat([
    { role: 'system', content: 'You are a code analyst. Be concise.' },
    { role: 'user', content: `Summarize this GitHub repo in 3-4 sentences.\nName: ${repoInfo.full_name}\nDescription: ${repoInfo.description}\nLanguage: ${repoInfo.language}\nStars: ${repoInfo.stargazers_count}` },
  ])
  return text
}

// ── 3. Dependency Graph Analysis ──────────────────────────────────────────────

export async function analyzeGraph(filename, content, repoContext = '') {
  const text = await groqChat([
    { role: 'system', content: 'You are an expert code analyst. Always respond with valid JSON only, no markdown fences.' },
    {
      role: 'user', content: `Analyze the dependency relationships in this file.

Repository context: ${repoContext}
Filename: ${filename}

File content:
${content.slice(0, 900)}

Respond in JSON:
{
  "imports": [
    { "module": "module-name", "type": "npm|local|builtin", "usedFor": "brief description of why it's imported" }
  ],
  "likelyImportedBy": ["list of files that likely import this file based on what it exports"],
  "architectureRole": "one sentence describing where this file sits in the architecture",
  "dataFlow": "one sentence describing how data flows through this file"
}` },
  ], 360)
  return parseJson(text, { imports: [], likelyImportedBy: [], architectureRole: '', dataFlow: '' })
}

// ── 4. Definitions Analysis ───────────────────────────────────────────────────

export async function analyzeDefinitions(filename, content, repoContext = '') {
  const text = await groqChat([
    { role: 'system', content: 'You are an expert code analyst. Always respond with valid JSON only, no markdown fences.' },
    {
      role: 'user', content: `List and analyze every exported function, class, constant, type, and interface in this file.

Repository context: ${repoContext}
Filename: ${filename}

File content:
${content.slice(0, 900)}

Respond in JSON:
{
  "definitions": [
    {
      "name": "functionOrClassName",
      "kind": "function|class|const|type|interface|hook|component",
      "description": "what it does in one sentence",
      "params": "parameter signature if applicable, or empty string",
      "returns": "return type/value description, or empty string",
      "isExported": true
    }
  ],
  "patterns": ["design patterns used, e.g. singleton, factory, observer"],
  "totalComplexity": "low|medium|high"
}` },
  ], 420)
  return parseJson(text, { definitions: [], patterns: [], totalComplexity: 'low' })
}

// ── 5. Onboarding Guide ──────────────────────────────────────────────────────

export async function analyzeOnboarding(filename, content, repoContext = '') {
  const text = await groqChat([
    { role: 'system', content: 'You are an expert code mentor. Always respond with valid JSON only, no markdown fences.' },
    {
      role: 'user', content: `Write a developer onboarding guide for this file. A new developer is reading this for the first time.

Repository context: ${repoContext}
Filename: ${filename}

File content:
${content.slice(0, 900)}

Respond in JSON:
{
  "whatItSolves": "1-2 sentences on the problem this file solves",
  "prerequisites": ["concepts or tools the developer should understand first"],
  "keyConcepts": [
    { "concept": "name", "explanation": "brief explanation" }
  ],
  "howToModify": [
    { "scenario": "what you want to change", "steps": "how to do it safely" }
  ],
  "pitfalls": [
    { "issue": "common mistake", "prevention": "how to avoid it" }
  ],
  "readingOrder": ["suggested order of files to read to understand this part of the codebase"]
}` },
  ], 480)
  return parseJson(text, { whatItSolves: '', prerequisites: [], keyConcepts: [], howToModify: [], pitfalls: [], readingOrder: [] })
}

// ── 6. Repo Roast ────────────────────────────────────────────────────────────

export async function analyzeRoast(filename, content, repoContext = '') {
  const text = await groqChat([
    {
      role: 'system',
      content: 'You are a witty senior engineer. Roast constructively: funny but never abusive. Always respond with valid JSON only, no markdown fences.'
    },
    {
      role: 'user',
      content: `Create a playful roast for this repository file and context.

Repository context: ${repoContext}
Filename: ${filename}

File content:
${content.slice(0, 1200)}

Respond in JSON:
{
  "roast": "short playful roast paragraph",
  "rating": "mild|medium|spicy",
  "highlights": ["funny but specific callout", "another callout"],
  "fixes": ["practical fix suggestion", "another fix suggestion"]
}`
    },
  ], 420)

  const parsed = parseJson(text, { roast: '', rating: 'mild', highlights: [], fixes: [] })
  return {
    roast: parsed.roast || parsed.summary || '',
    rating: parsed.rating || 'mild',
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    fixes: Array.isArray(parsed.fixes) ? parsed.fixes : [],
  }
}

// ── 7. Ask AI Chat ────────────────────────────────────────────────────────────

export async function askRepoQuestion(question, context) {
  return await groqChat([
    { role: 'system', content: 'You are an expert developer assistant. Answer the user\'s question about their codebase using the provided context. Be practical, concise, and helpful.' },
    { role: 'user', content: `Question: ${question}\n\nContext:\n${context}` },
  ], 420)
}
