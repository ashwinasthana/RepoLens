const BASE = 'https://api.github.com'
const TOKEN = import.meta.env.VITE_GITHUB_TOKEN || ''

function ghHeaders() {
  const headers = { Accept: 'application/vnd.github+json' }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`
  return headers
}

async function ghFetch(path) {
  const res = await fetch(`${BASE}${path}`, { headers: ghHeaders() })
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${res.statusText}`)
  return res.json()
}

// 1. Parse a GitHub URL into { owner, repo }
export function parseGithubUrl(url) {
  let parsed
  try { parsed = new URL(url) } catch { throw new Error('Invalid URL') }
  if (parsed.hostname !== 'github.com') throw new Error('URL must be from github.com')
  const parts = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/')
  if (parts.length < 2 || !parts[0] || !parts[1]) throw new Error('URL must be github.com/owner/repo')
  return { owner: parts[0], repo: parts[1] }
}

// 2. Fetch the full file tree as nested { name, path, type, children[] }
export async function fetchFileTree(owner, repo) {
  const data = await ghFetch(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`)
  if (data.truncated) console.warn('Tree truncated — repo is very large')

  const root = { name: repo, path: '', type: 'tree', children: [] }
  const map = { '': root }

  // Sort so parent dirs are always created before children
  const sorted = [...data.tree].sort((a, b) => a.path.localeCompare(b.path))

  for (const item of sorted) {
    const parts = item.path.split('/')
    const name = parts[parts.length - 1]
    const parentPath = parts.slice(0, -1).join('/')
    const node = { name, path: item.path, type: item.type, children: item.type === 'tree' ? [] : undefined }
    map[item.path] = node
    const parent = map[parentPath] ?? root
    parent.children.push(node)
  }

  return root
}

// 3. Fetch and decode a file's content from base64
export async function fetchFileContent(owner, repo, path) {
  const data = await ghFetch(`/repos/${owner}/${repo}/contents/${path}`)
  if (data.encoding !== 'base64') throw new Error(`Unexpected encoding: ${data.encoding}`)
  return atob(data.content.replace(/\n/g, ''))
}
