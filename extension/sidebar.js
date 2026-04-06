// sidebar.js — runs inside the sidebar iframe

// ── Helpers ───────────────────────────────────────────────────────────────────

const EXT_ICON = { js:'🟨', jsx:'🟨', ts:'🔷', tsx:'🔷', py:'🐍', md:'📝', json:'{}' }
const EXT_LANG = {
  js:'JavaScript', jsx:'JavaScript', ts:'TypeScript', tsx:'TypeScript',
  py:'Python', rb:'Ruby', go:'Go', rs:'Rust', java:'Java', cs:'C#',
  cpp:'C++', c:'C', php:'PHP', html:'HTML', css:'CSS', json:'JSON',
  md:'Markdown', yml:'YAML', yaml:'YAML', sh:'Shell', sql:'SQL',
}
const ENTRY = new Set(['index.js','index.jsx','index.ts','index.tsx','main.py','app.js','app.jsx','main.js','main.ts'])

function getExt(name)  { return name.split('.').pop().toLowerCase() }
function fileIcon(name){ return EXT_ICON[getExt(name)] ?? '📄' }

function parseDeps(content) {
  const found = new Set()
  const re = /(?:import\s+(?:.*?\s+from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(content)) !== null) found.add(m[1])
  const local = [], npm = []
  for (const d of found) (d.startsWith('.') ? local : npm).push(d)
  return { local, npm }
}

// Send a message to background.js and return a Promise
function send(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (res) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message))
      }
      if (res && res.error) return reject(new Error(res.error))
      resolve(res)
    })
  })
}

// ── State ─────────────────────────────────────────────────────────────────────

let owner = ''
let repo  = ''
let repoContext  = ''
let selectedPath = ''

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

// Parse repoUrl from query string — never let this crash the whole script
const params  = new URLSearchParams(location.search)
const repoUrl = params.get('repoUrl') || ''

console.log('[RepoLens sidebar] loaded, repoUrl =', repoUrl)

// Wake the service worker before any real messages — MV3 workers can be suspended
chrome.runtime.sendMessage({ type: 'PING' }, () => { void chrome.runtime.lastError })

if (repoUrl) {
  try {
    const parsed = parseGithubUrl(repoUrl)   // defined in services.js
    owner = parsed.owner
    repo  = parsed.repo
    if ($repoName) $repoName.textContent = `${owner}/${repo}`
    console.log('[RepoLens sidebar] owner =', owner, 'repo =', repo)
  } catch (err) {
    console.error('[RepoLens sidebar] parseGithubUrl failed:', err)
    showError('Could not parse repo URL: ' + err.message)
  }
} else {
  showError('No repoUrl parameter found')
}

// Close button → tell parent content.js to remove the iframe
document.getElementById('close-btn').addEventListener('click', () => {
  window.parent.postMessage('REPOLENS_CLOSE', '*')
})

$analyzeBtn.addEventListener('click', handleAnalyze)

// ── Analyze ───────────────────────────────────────────────────────────────────

async function handleAnalyze() {
  if (!owner || !repo) { showError('No repo detected'); return }

  setLoading(true, 'Scanning repository…')
  clearError()
  $analyzeBtn.disabled = true
  console.log('[RepoLens sidebar] analyzing', owner, repo)

  try {
    const [info, tree] = await Promise.all([
      send('FETCH_REPO_INFO', { owner, repo }),
      send('FETCH_FILE_TREE', { owner, repo }),
    ])
    console.log('[RepoLens sidebar] got tree, children:', tree?.children?.length)

    repoContext = `${info.full_name} — ${info.description ?? ''} (${info.language ?? 'unknown'})`
    renderTree(tree)

    const fileCount = countFiles(tree)
    if ($treeHeader) $treeHeader.textContent = `${fileCount} files`
    if ($statusText) $statusText.innerHTML =
      `<span class="status-dot"></span> ${info.full_name} · ${info.language ?? '?'} · analyzed just now`
  } catch (err) {
    console.error('[RepoLens sidebar] analyze error:', err)
    showError(err.message)
  } finally {
    setLoading(false)
    $analyzeBtn.disabled = false
  }
}

// ── Tree rendering ────────────────────────────────────────────────────────────

function countFiles(node) {
  return (node.children ?? []).reduce(
    (acc, c) => acc + (c.type === 'blob' ? 1 : countFiles(c)), 0
  )
}

function renderTree(root) {
  if (!$treeScroll) return
  $treeScroll.innerHTML = ''
  for (const child of root.children ?? []) {
    $treeScroll.appendChild(buildNode(child, 0))
  }
}

function buildNode(node, depth) {
  const wrap   = document.createElement('div')
  const indent = 8 + depth * 12

  if (node.type === 'blob') {
    const row = document.createElement('div')
    row.className        = 'tree-row'
    row.style.paddingLeft = indent + 'px'
    row.title            = node.path
    row.innerHTML = `<span>${fileIcon(node.name)}</span>` +
                    `<span style="overflow:hidden;text-overflow:ellipsis">${node.name}</span>`
    row.addEventListener('click', () => handleFileClick(node, row))
    wrap.appendChild(row)
  } else {
    const row = document.createElement('div')
    row.className        = 'tree-row'
    row.style.paddingLeft = indent + 'px'
    row.innerHTML = `<span class="arrow">▸</span>` +
                    `<span class="folder-name" style="overflow:hidden;text-overflow:ellipsis">${node.name}</span>`

    const childWrap = document.createElement('div')
    childWrap.className = 'tree-children'
    for (const child of node.children ?? []) {
      childWrap.appendChild(buildNode(child, depth + 1))
    }

    let open = false
    row.addEventListener('click', () => {
      open = !open
      row.querySelector('.arrow').classList.toggle('open', open)
      childWrap.classList.toggle('open', open)
    })

    wrap.appendChild(row)
    wrap.appendChild(childWrap)
  }
  return wrap
}

// ── File click ────────────────────────────────────────────────────────────────

async function handleFileClick(node, rowEl) {
  document.querySelectorAll('.tree-row.selected').forEach(r => r.classList.remove('selected'))
  rowEl.classList.add('selected')
  selectedPath = node.path

  renderDetailLoading(node)
  clearError()

  try {
    const content = await send('FETCH_FILE_CONTENT', { owner, repo, path: node.path })
    renderDetail(node, content, null)

    // AI analysis — non-blocking
    send('ANALYZE_FILE', { filename: node.name, content, repoContext })
      .then(summary => {
        if (selectedPath === node.path) renderDetail(node, content, summary)
      })
      .catch(err => showError('AI: ' + err.message))
  } catch (err) {
    console.error('[RepoLens sidebar] file fetch error:', err)
    showError(err.message)
  }
}

// ── Detail rendering ──────────────────────────────────────────────────────────

function renderDetailLoading(node) {
  if (!$detailPanel) return
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
  if (!$detailPanel) return
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

function setLoading(on, text) {
  if (!$overlay) return
  $overlay.classList.toggle('visible', on)
  if (text && $loadingText) $loadingText.textContent = text
}

function showError(msg) {
  if (!$errorBar) { console.error('[RepoLens]', msg); return }
  $errorBar.textContent = '⚠ ' + msg
  $errorBar.style.display = 'block'
}

function clearError() {
  if (!$errorBar) return
  $errorBar.textContent = ''
  $errorBar.style.display = 'none'
}
