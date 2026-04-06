const OPENAI_BASE = 'https://api.openai.com/v1'

async function chat(messages, apiKey) {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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
      {
        role: 'user',
        content: `Summarize this file in 2-3 sentences. File: ${filename}\n\n${truncated}`,
      },
    ],
    apiKey
  )
}

export async function extractDependencies(filename, content, apiKey) {
  const truncated = content.slice(0, 3000)
  return chat(
    [
      { role: 'system', content: 'You are a code analyst. Reply with JSON only.' },
      {
        role: 'user',
        content: `List imports/dependencies as JSON array of strings. File: ${filename}\n\n${truncated}`,
      },
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
