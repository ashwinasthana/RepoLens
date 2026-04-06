// sidebar.js — runs inside the sidebar iframe

// ── Helpers ───────────────────────────────────────────────────────────────────

const EXT_ICON = { js:'🟨',jsx:'🟨',ts:'🔷',tsx:'🔷',py:'🐍',md:'📝',json:'{}' }
const EXT_LANG = {
  js:'JavaScript',jsx:'JavaScript',ts:'TypeScript',tsx:'TypeScript',
  py:'Python',rb:'Ruby',go:'Go',rs:'Rust',java:'Java',cs:'C#',
  cpp:'C++',c:'C',php:'PHP',html:'HTML',css:'CSS',json:'JSON',
  md:'Markdown',yml:'YAML',yaml:'YAML',sh:'Shell',sql:'SQL',
}
const ENTRY = new Set(['index.js','index.jsx','index.ts','index.tsx','main.py','app.js','app.jsx','main.js','main.ts'])

function getExt(name) { return name.split('.').pop().toLowerCase() }
function fileIcon(name) { return EXT_ICON[getExt(name)] ?? '📄' }

function parseDeps(content) {
  const found = new Set()
  const re = /(?:import\s+(?:.*?\s+from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(content)) !== null) found.add(m[1])
  const local = [], npm = []
  for (const d of found) (d.startsWith('.') ? local : npm).push(d)
  return { local, npm }
}

function send(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, res => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
      if (res?.error) return reject(new Error(res.error))
      resolve(res)
    })
  })
}

// ── State ─────────────────────────────────────────────────────────────────────

const params   = new URLSearchParams(location.search)
const repoUrl  = params.get('repoUrl') || location.href
let owner = '', repo = '', repoContext = '', selectedPath = ''

// ── DOM refs ──────────────────────────────────────────────────────────────────

const $repoName    = document.getElementById('repo-name')
const $analyzeBtn  = document.getElementById('analyze-btn')
const $errorBar    = document.getElementById('error-bar')
const $treeScroll  = document.getElementById('tree-scroll')
const $treeHeader  = document.getElementById('tree-header')
const $detailPanel = document.getElementById('detail-panel')
const $statusText  = document.getElementById('status-text')
const $overlay     = document.getElementById('loading-overlay')
const $loadingText = document.getElementById('loading-text')

// ── Init ──────────────────────────────────────────────────────────────────────

try {
  const parsed = parseGithubUrl(repoUrl)   // from services.js
  owner = parsed.owner
  repo  = parsed.repo
  $repoName.textContent = `${owner}/${repo}`
} catch {
  showError('Could not detect repo from URL')
}

document.getElementById('close-btn').addEventListener('click', () => {
  window.parent.postMessage('REPOLENS_CLOSE', '*')
})

$analyzeBtn.addEventListener('click', handleAnalyze)

// ── Analyze ───────────────────────────────────────────────────────────────────

async function handleAnalyze() {
  setLoading(true, 'Scanning repository…')
  clearError()
  $analyzeBtn.disabled = true

  try {
    const [info, tree] = await Promise.all([
      send('FETCH_REPO_INFO', { owner, repo }),
      send('FETCH_FILE_TREE', { owner, repo }),
    ])
    repoContext = `${info.full_name} — ${info.description ?? ''} (${info.language ?? 'unknown'})`
    renderTree(tree)

    const fileCount = countFiles(tree)
    $treeHeader.textContent = `${fileCount} files`
    $statusText.innerHTML = `<span class="status-dot"></span> ${info.full_name} · ${info.language ?? '?'} · analyzed just now`
  } catch (e) {
    showError(e.message)
  } finally {
    setLoading(false)
    $analyzeBtn.disabled = false
  }
}

// ── Tree rendering ────────────────────────────────────────────────────────────

function countFiles(node) {
  return (node.children ?? []).reduce((acc, c) => acc + (c.type === 'blob' ? 1 : countFiles(c)), 0)
}

function renderTree(root) {
  $treeScroll.innerHTML = ''
  for (const child of root.children ?? []) {
    $treeScroll.appendChild(buildNode(child, 0))
  }
}

function buildNode(node, depth) {
  const wrap = document.createElement('div')
  const indent = 8 + depth * 12

  if (node.type === 'blob') {
    const row = document.createElement('div')
    row.className = 'tree-row'
    row.style.paddingLeft = indent + 'px'
    row.title = node.path
    row.innerHTML = `<span>${fileIcon(node.name)}</span><span style="overflow:hidden;text-overflow:ellipsis">${node.name}</span>`
    row.addEventListener('click', () => handleFileClick(node, row))
    wrap.appendChild(row)
  } else {
    const row = document.createElement('div')
    row.className = 'tree-row'
    row.style.paddingLeft = indent + 'px'
    row.innerHTML = `<span class="arrow">▸</span><span class="folder-name" style="overflow:hidden;text-overflow:ellipsis">${node.name}</span>`

    const children = document.createElement('div')
    children.className = 'tree-children'
    for (const child of node.children ?? []) children.appendChild(buildNode(child, depth + 1))

    let open = false
    row.addEventListener('click', () => {
      open = !open
      row.querySelector('.arrow').classList.toggle('open', open)
      children.classList.toggle('open', open)
    })
    wrap.appendChild(row)
    wrap.appendChild(children)
  }
  return wrap
}

// ── File click ────────────────────────────────────────────────────────────────

async function handleFileClick(node, rowEl) {
  // Highlight selected
  document.querySelectorAll('.tree-row.selected').forEach(r => r.classList.remove('selected'))
  rowEl.classList.add('selected')
  selectedPath = node.path

  renderDetailLoading(node)

  try {
    const content = await send('FETCH_FILE_CONTENT', { owner, repo, path: node.path })
    renderDetail(node, content, null)

    // AI — non-blocking
    send('ANALYZE_FILE', { filename: node.name, content, repoContext })
      .then(summary => { if (selectedPath === node.path) renderDetail(node, content, summary) })
      .catch(e => showError(`AI: ${e.message}`))
  } catch (e) {
    showError(e.message)
  }
}

// ── Detail rendering ──────────────────────────────────────────────────────────

function renderDetailLoading(node) {
  const ext  = getExt(node.name)
  const lang = EXT_LANG[ext] ?? ext.toUpperCase()
  $detailPanel.innerHTML = `
    <div class="detail-filename">${node.name}</div>
    <div class="detail-badges">
      <span class="badge">.${ext}</span>
      ${ENTRY.has(node.name) ? '<span class="badge badge-entry">Entry point</span>' : ''}
    </div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-val">—</div><div class="stat-key">Lines</div></div>
      <div class="stat-card"><div class="stat-val">—</div><div class="stat-key">Size</div></div>
      <div class="stat-card"><div class="stat-val">${lang}</div><div class="stat-key">Language</div></div>
    </div>
    <div class="section">
      <div class="section-label">What this file does</div>
      <div class="summary-card">${skeletonHTML()}</div>
    </div>`
}

function renderDetail(node, content, summary) {
  const ext   = getExt(node.name)
  const lang  = EXT_LANG[ext] ?? ext.toUpperCase()
  const lines = content.split('\n').length
  const kb    = (new Blob([content]).size / 1024).toFixed(1)
  const { local, npm } = parseDeps(content)

  const summaryText = summary?.summary || ''
  const purpose     = summary?.purpose || ''

  $detailPanel.innerHTML = `
    <div class="detail-filename">${node.name}</div>
    <div class="detail-badges">
      <span class="badge">.${ext}</span>
      ${ENTRY.has(node.name) ? '<span class="badge badge-entry">Entry point</span>' : ''}
      ${summary?.complexity ? `<span class="badge">${summary.complexity}</span>` : ''}
    </div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-val">${lines.toLocaleString()}</div><div class="stat-key">Lines</div></div>
      <div class="stat-card"><div class="stat-val">${kb} KB</div><div class="stat-key">Size</div></div>
      <div class="stat-card"><div class="stat-val">${lang}</div><div class="stat-key">Language</div></div>
    </div>
    <div class="section">
      <div class="section-label">What this file does</div>
      <div class="summary-card">
        ${purpose ? `<div style="font-size:11px;font-weight:600;color:#58a6ff;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">${purpose}</div>` : ''}
        ${summaryText || '<span style="color:var(--muted)">No summary available.</span>'}
      </div>
    </div>
    ${(npm.length || local.length) ? `
    <div class="section">
      <div class="section-label">Dependencies</div>
      <div class="pills">
        ${npm.map(d => `<span class="pill pill-npm">${d}</span>`).join('')}
        ${local.map(d => `<span class="pill pill-local">${d}</span>`).join('')}
      </div>
    </div>` : ''}
    ${summary?.suggestedNextFiles?.length ? `
    <div class="section">
      <div class="section-label">Read next</div>
      <div class="pills">
        ${summary.suggestedNextFiles.map(f => `<span class="pill pill-local">${f}</span>`).join('')}
      </div>
    </div>` : ''}
  `
}

function skeletonHTML() {
  return `<div class="skeleton-wrap">
    <div class="skeleton sk-long"></div>
    <div class="skeleton sk-med"></div>
    <div class="skeleton sk-short"></div>
  </div>`
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function setLoading(on, text = '') {
  $overlay.classList.toggle('visible', on)
  if (text) $loadingText.textContent = text
}

function showError(msg) {
  $errorBar.textContent = '⚠ ' + msg
  $errorBar.style.display = 'block'
}

function clearError() {
  $errorBar.textContent = ''
  $errorBar.style.display = 'none'
}
