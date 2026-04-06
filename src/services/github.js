const BASE = 'https://api.github.com'

function parseRepoUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) throw new Error('Invalid GitHub URL')
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
}

async function ghFetch(path, token) {
  const headers = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { headers })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  return res.json()
}

export async function getRepoInfo(url, token) {
  const { owner, repo } = parseRepoUrl(url)
  return ghFetch(`/repos/${owner}/${repo}`, token)
}

export async function getRepoTree(url, token) {
  const { owner, repo } = parseRepoUrl(url)
  const { default_branch } = await getRepoInfo(url, token)
  return ghFetch(`/repos/${owner}/${repo}/git/trees/${default_branch}?recursive=1`, token)
}

export async function getFileContent(url, filePath, token) {
  const { owner, repo } = parseRepoUrl(url)
  const data = await ghFetch(`/repos/${owner}/${repo}/contents/${filePath}`, token)
  return atob(data.content.replace(/\n/g, ''))
}

export async function getFileCommits(url, filePath, token) {
  const { owner, repo } = parseRepoUrl(url)
  return ghFetch(`/repos/${owner}/${repo}/commits?path=${filePath}&per_page=5`, token)
}
