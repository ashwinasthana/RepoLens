const GROQ_BASE  = 'https://api.groq.com/openai/v1'
const GROQ_MODEL = 'llama-3.1-8b-instant'

const FALLBACK = { summary: '', purpose: '', keyExports: [], complexity: 'low', suggestedNextFiles: [] }

// ── Shared fetch helper ───────────────────────────────────────────────────────

async function groqChat(messages, maxTokens = 1024) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY is not set')

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.2, max_tokens: maxTokens }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Groq error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

// ── JSON parser ───────────────────────────────────────────────────────────────

function parseJson(text, fallback = {}) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return { ...fallback, ...JSON.parse(cleaned) } }
  catch { return { ...fallback, summary: text.trim() } }
}

// ── 1. File Analysis (Summary tab) ────────────────────────────────────────────

export async function analyzeFile(filename, content, repoContext = '') {
  const text = await groqChat([
    { role: 'system', content: 'You are a code analyst. Always respond with valid JSON only, no markdown fences.' },
    { role: 'user',   content: `You are a code explanation assistant. Analyze this file from a GitHub repository.

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
}` },
  ])
  return parseJson(text, FALLBACK)
}

// ── 2. Repo Summary ──────────────────────────────────────────────────────────

export async function summarizeRepo(repoInfo) {
  const text = await groqChat([
    { role: 'system', content: 'You are a code analyst. Be concise.' },
    { role: 'user',   content: `Summarize this GitHub repo in 3-4 sentences.\nName: ${repoInfo.full_name}\nDescription: ${repoInfo.description}\nLanguage: ${repoInfo.language}\nStars: ${repoInfo.stargazers_count}` },
  ])
  return text
}

// ── 3. Dependency Graph Analysis ──────────────────────────────────────────────

export async function analyzeGraph(filename, content, repoContext = '') {
  const text = await groqChat([
    { role: 'system', content: 'You are an expert code analyst. Always respond with valid JSON only, no markdown fences.' },
    { role: 'user',   content: `Analyze the dependency relationships in this file.

Repository context: ${repoContext}
Filename: ${filename}

File content:
${content.slice(0, 2000)}

Respond in JSON:
{
  "imports": [
    { "module": "module-name", "type": "npm|local|builtin", "usedFor": "brief description of why it's imported" }
  ],
  "likelyImportedBy": ["list of files that likely import this file based on what it exports"],
  "architectureRole": "one sentence describing where this file sits in the architecture",
  "dataFlow": "one sentence describing how data flows through this file"
}` },
  ])
  return parseJson(text, { imports: [], likelyImportedBy: [], architectureRole: '', dataFlow: '' })
}

// ── 4. Definitions Analysis ───────────────────────────────────────────────────

export async function analyzeDefinitions(filename, content, repoContext = '') {
  const text = await groqChat([
    { role: 'system', content: 'You are an expert code analyst. Always respond with valid JSON only, no markdown fences.' },
    { role: 'user',   content: `List and analyze every exported function, class, constant, type, and interface in this file.

Repository context: ${repoContext}
Filename: ${filename}

File content:
${content.slice(0, 2000)}

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
  ], 2048)
  return parseJson(text, { definitions: [], patterns: [], totalComplexity: 'low' })
}

// ── 5. Onboarding Guide ──────────────────────────────────────────────────────

export async function analyzeOnboarding(filename, content, repoContext = '') {
  const text = await groqChat([
    { role: 'system', content: 'You are an expert code mentor. Always respond with valid JSON only, no markdown fences.' },
    { role: 'user',   content: `Write a developer onboarding guide for this file. A new developer is reading this for the first time.

Repository context: ${repoContext}
Filename: ${filename}

File content:
${content.slice(0, 2000)}

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
  ], 2048)
  return parseJson(text, { whatItSolves: '', prerequisites: [], keyConcepts: [], howToModify: [], pitfalls: [], readingOrder: [] })
}

// ── 6. Ask AI Chat ────────────────────────────────────────────────────────────

export async function askRepoQuestion(question, context) {
  return await groqChat([
    { role: 'system', content: 'You are an expert developer assistant. Answer the user\'s question about their codebase using the provided context. Be practical, concise, and helpful.' },
    { role: 'user',   content: `Question: ${question}\n\nContext:\n${context}` },
  ], 1024)
}
