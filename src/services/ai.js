const GROQ_BASE  = 'https://api.groq.com/openai/v1'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

const FALLBACK = { summary: '', purpose: '', keyExports: [], complexity: 'low', suggestedNextFiles: [] }

// ── Shared fetch helper ───────────────────────────────────────────────────────

async function groqChat(messages) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY is not set')

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.2, max_tokens: 1024 }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Groq error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

// ── Prompt + parser ───────────────────────────────────────────────────────────

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

function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return { ...FALLBACK, ...JSON.parse(cleaned) } }
  catch { return { ...FALLBACK, summary: text.trim() } }
}

// ── Exports ───────────────────────────────────────────────────────────────────

export async function analyzeFile(filename, content, repoContext = '') {
  const text = await groqChat([
    { role: 'system', content: 'You are a code analyst. Always respond with valid JSON only, no markdown fences.' },
    { role: 'user',   content: buildPrompt(filename, content, repoContext) },
  ])
  return parseJson(text)
}

export async function summarizeRepo(repoInfo) {
  const text = await groqChat([
    { role: 'system', content: 'You are a code analyst. Be concise.' },
    { role: 'user',   content: `Summarize this GitHub repo in 3-4 sentences.\nName: ${repoInfo.full_name}\nDescription: ${repoInfo.description}\nLanguage: ${repoInfo.language}\nStars: ${repoInfo.stargazers_count}` },
  ])
  return text
}
