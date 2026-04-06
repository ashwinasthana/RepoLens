// sidebar.js

// ── Constants ─────────────────────────────────────────────────────────────────

const EXT_LANG = {
  js:'JavaScript', jsx:'JavaScript', ts:'TypeScript', tsx:'TypeScript',
  py:'Python', rb:'Ruby', go:'Go', rs:'Rust', java:'Java', cs:'C#',
  cpp:'C++', c:'C', php:'PHP', html:'HTML', css:'CSS', json:'JSON',
  md:'Markdown', yml:'YAML', yaml:'YAML', sh:'Shell', sql:'SQL',
}
const ENTRY = new Set(['index.js','index.jsx','index.ts','index.tsx','main.py','app.js','app.jsx','main.js','main.ts'])

const FILE_ICON = {
  js:'ti-brand-javascript', jsx:'ti-brand-react', ts:'ti-brand-typescript',
  tsx:'ti-brand-react', py:'ti-brand-python', md:'ti-markdown',
  json:'ti-braces', html:'ti-brand-html5', css:'ti-brand-css3',
  sh:'ti-terminal', sql:'ti-database', go:'ti-brand-golang',
  rs:'ti-brand-rust', java:'ti-coffee',
}

const TABS = [
  { id:'summary',     icon:'ti-sparkles',        label:'Summary'     },
  { id:'explain',     icon:'ti-book-2',           label:'Explain'     },
  { id:'graph',       icon:'ti-hierarchy-2',      label:'Graph'       },
  { id:'definitions', icon:'ti-list-details',     label:'Definitions' },
  { id:'onboarding',  icon:'ti-map',              label:'Onboarding'  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getExt(name) { return name.split('.').pop().toLowerCase() }

function fileIconClass(name) {
  return FILE_ICON[getExt(name)] ?? 'ti-file'
}

function parseDeps(content) {
  const found = new Set()
  const re = /(?:import\s+(?:.*?\s+from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(content)) !== null) found.add(m[1])
  const local = [], npm = []
  for (const d of found) (d.startsWith('.') ? local : npm).push(d)
  return { local, npm }
}

function parseDefinitions(content) {
  const defs = []
  const patterns = [
    { re: /^export\s+(?:default\s+)?function\s+(\w+)/gm,   kind: 'fn'    },
    { re: /^export\s+(?:default\s+)?class\s+(\w+)/gm,      kind: 'class' },
    { re: /^export\s+(?:const|let|var)\s+(\w+)/gm,         kind: 'const' },
    { re: /^export\s+type\s+(\w+)/gm,                       kind: 'type'  },
    { re: /^export\s+interface\s+(\w+)/gm,                  kind: 'type'  },
    { re: /^def\s+(\w+)\s*\(/gm,                            kind: 'fn'    },
    { re: /^class\s+(\w+)/gm,                               kind: 'class' },
    { re: /^func\s+(\w+)/gm,                                kind: 'fn'    },
    { re: /^fn\s+(\w+)/gm,                                  kind: 'fn'    },
  ]
  for (const { re, kind } of patterns) {
    let match
    while ((match = re.exec(content)) !== null) {
      if (!defs.find(d => d.name === match[1])) defs.push({ name: match[1], kind })
    }
  }
  return defs
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

function skeletonHTML(rows = 3) {
  const sizes = ['sk-long','sk-med','sk-short']
  return `<div class="skeleton-wrap">${Array.from({length:rows}, (_,i) =>
    `<div class="skeleton ${sizes[i % 3]}"></div>`).join('')}</div>`
}

// ── State ─────────────────────────────────────────────────────────────────────

let owner = '', repo = '', repoContext = '', selectedPath = ''
let currentContent = '', currentNode = null
let activeTab = 'summary'
let tabCache = {}   // { [path]: { summary, explain, graph, definitions, onboarding } }

// ── DOM ───────────────────────────────────────────────────────────────────────

const $repoName    = document.getElementById('repo-name')
const $analyzeBtn  = document.getElementById('analyze-btn')
const $errorBar    = document.getElementById('error-bar')
const $treeScroll  = document.getElementById('tree-scroll')
const $treeCount   = document.getElementById('tree-count')
const $detailPanel = document.getElementById('detail-panel')
const $statusText  = document.getElementById('status-text')
const $overlay     = document.getElementById('loading-overlay')
const $loadingText = document.getElementById('loading-text')

// ── Init ──────────────────────────────────────────────────────────────────────

const params  = new URLSearchParams(location.search)
const repoUrl = params.get('repoUrl') || ''

chrome.runtime.sendMessage({ type: 'PING' }, () => { void chrome.runtime.lastError })

if (repoUrl) {
  try {
    const parsed = parseGithubUrl(repoUrl)
    owner = parsed.owner; repo = parsed.repo
    if ($repoName) $repoName.textContent = `${owner}/${repo}`
  } catch (err) { showError('Could not parse repo URL: ' + err.message) }
} else { showError('No repoUrl parameter found') }

document.getElementById('close-btn').addEventListener('click', () => {
  window.parent.postMessage('REPOLENS_CLOSE', '*')
})

document.getElementById('open-web-btn').addEventListener('click', openInWebApp)
$analyzeBtn.addEventListener('click', handleAnalyze)

// ── Analyze ───────────────────────────────────────────────────────────────────

async function handleAnalyze() {
  if (!owner || !repo) { showError('No repo detected'); return }
  setLoading(true, 'Scanning repository…')
  clearError()
  $analyzeBtn.disabled = true
  tabCache = {}

  try {
    const [info, tree] = await Promise.all([
      send('FETCH_REPO_INFO', { owner, repo }),
      send('FETCH_FILE_TREE', { owner, repo }),
    ])
    repoContext = `${info.full_name} — ${info.description ?? ''} (${info.language ?? 'unknown'})`
    renderTree(tree)
    const fc = countFiles(tree)
    if ($treeCount) $treeCount.textContent = `${fc} files`
    if ($statusText) $statusText.innerHTML =
      `${info.full_name} · ${info.language ?? '?'} · analyzed just now`
  } catch (err) {
    showError(err.message)
  } finally {
    setLoading(false)
    $analyzeBtn.disabled = false
  }
}

// ── Tree ──────────────────────────────────────────────────────────────────────

function countFiles(node) {
  return (node.children ?? []).reduce((a,c) => a + (c.type==='blob' ? 1 : countFiles(c)), 0)
}

function renderTree(root) {
  if (!$treeScroll) return
  $treeScroll.innerHTML = ''
  for (const child of root.children ?? []) $treeScroll.appendChild(buildNode(child, 0))
}

function buildNode(node, depth) {
  const wrap = document.createElement('div')
  const indent = 8 + depth * 12

  if (node.type === 'blob') {
    const row = document.createElement('div')
    row.className = 'tree-row'
    row.style.paddingLeft = indent + 'px'
    row.title = node.path
    row.innerHTML = `<i class="ti ${fileIconClass(node.name)}"></i><span class="file-name">${node.name}</span>`
    row.addEventListener('click', () => handleFileClick(node, row))
    wrap.appendChild(row)
  } else {
    const row = document.createElement('div')
    row.className = 'tree-row'
    row.style.paddingLeft = indent + 'px'
    row.innerHTML = `<span class="arrow">▸</span><i class="ti ti-folder" style="color:#e3b341"></i><span class="folder-name">${node.name}</span>`

    const childWrap = document.createElement('div')
    childWrap.className = 'tree-children'
    for (const child of node.children ?? []) childWrap.appendChild(buildNode(child, depth + 1))

    let open = false
    row.addEventListener('click', () => {
      open = !open
      row.querySelector('.arrow').classList.toggle('open', open)
      row.querySelector('.ti-folder, .ti-folder-open')?.classList.toggle('ti-folder', !open)
      row.querySelector('.ti-folder, .ti-folder-open')?.classList.toggle('ti-folder-open', open)
      childWrap.classList.toggle('open', open)
    })
    wrap.appendChild(row); wrap.appendChild(childWrap)
  }
  return wrap
}

// ── File click ────────────────────────────────────────────────────────────────

async function handleFileClick(node, rowEl) {
  document.querySelectorAll('.tree-row.selected').forEach(r => r.classList.remove('selected'))
  rowEl.classList.add('selected')
  selectedPath = node.path
  currentNode = node
  clearError()

  renderFileShell(node, null, null)

  try {
    const content = await send('FETCH_FILE_CONTENT', { owner, repo, path: node.path })
    currentContent = content
    renderFileShell(node, content, tabCache[node.path] ?? null)
    fetchTabData(node, content)
  } catch (err) {
    showError(err.message)
  }
}

// ── Fetch all tab data from Groq ──────────────────────────────────────────────

async function fetchTabData(node, content) {
  const path = node.path
  if (tabCache[path]) return

  tabCache[path] = {}

  // All 5 prompts fired in parallel
  const [summary, explain, graph, definitions, onboarding] = await Promise.allSettled([
    send('ANALYZE_FILE', { filename: node.name, content, repoContext }),
    send('EXPLAIN_FILE', { filename: node.name, content, repoContext }),
    send('GRAPH_FILE',   { filename: node.name, content, repoContext }),
    send('DEFS_FILE',    { filename: node.name, content, repoContext }),
    send('ONBOARD_FILE', { filename: node.name, content, repoContext }),
  ])

  tabCache[path] = {
    summary:     summary.status     === 'fulfilled' ? summary.value     : null,
    explain:     explain.status     === 'fulfilled' ? explain.value     : null,
    graph:       graph.status       === 'fulfilled' ? graph.value       : null,
    definitions: definitions.status === 'fulfilled' ? definitions.value : null,
    onboarding:  onboarding.status  === 'fulfilled' ? onboarding.value  : null,
  }

  if (selectedPath === path) renderFileShell(node, content, tabCache[path])
}

// ── Render shell with tabs ────────────────────────────────────────────────────

function renderFileShell(node, content, cache) {
  if (!$detailPanel) return
  const ext  = getExt(node.name)
  const lang = EXT_LANG[ext] ?? ext.toUpperCase()
  const lines = content ? content.split('\n').length : 0
  const kb    = content ? (new Blob([content]).size / 1024).toFixed(1) : '—'
  const complexity = cache?.summary?.complexity ?? ''

  $detailPanel.innerHTML = `
    <div id="view-tabs">
      ${TABS.map(t => `
        <button class="view-tab ${activeTab===t.id?'active':''}" data-tab="${t.id}">
          <i class="ti ${t.icon}"></i>${t.label}
        </button>`).join('')}
    </div>
    <div id="tab-content">
      <div class="detail-filename">${node.name}</div>
      <div class="detail-badges">
        <span class="badge">.${ext}</span>
        ${ENTRY.has(node.name) ? '<span class="badge badge-entry"><i class="ti ti-door-enter"></i> Entry point</span>' : ''}
        ${complexity ? `<span class="badge badge-complexity-${complexity}">${complexity}</span>` : ''}
      </div>
      <div class="stats-row">
        <div class="stat-card"><div class="stat-val">${lines.toLocaleString()}</div><div class="stat-key">Lines</div></div>
        <div class="stat-card"><div class="stat-val">${kb} KB</div><div class="stat-key">Size</div></div>
        <div class="stat-card"><div class="stat-val">${lang}</div><div class="stat-key">Language</div></div>
      </div>
      <div id="tab-body">${renderTabBody(activeTab, content, cache)}</div>
    </div>`

  // Tab click handlers
  $detailPanel.querySelectorAll('.view-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab
      $detailPanel.querySelectorAll('.view-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab))
      document.getElementById('tab-body').innerHTML = renderTabBody(activeTab, currentContent, tabCache[selectedPath] ?? null)
    })
  })
}

// ── Tab body renderer ─────────────────────────────────────────────────────────

function renderTabBody(tab, content, cache) {
  if (!content) return skeletonHTML(4)

  switch (tab) {

    case 'summary': {
      const s = cache?.summary
      if (!s) return skeletonHTML(3)
      const { local, npm } = parseDeps(content)
      return `
        ${s.purpose ? `<div class="purpose-line"><i class="ti ti-target"></i> ${s.purpose}</div>` : ''}
        <div class="section">
          <div class="section-label"><i class="ti ti-sparkles"></i> What this file does</div>
          <div class="prose-card">${s.summary || '<span style="color:var(--muted)">No summary.</span>'}</div>
        </div>
        ${(npm.length||local.length) ? `
        <div class="section">
          <div class="section-label"><i class="ti ti-package"></i> Dependencies</div>
          <div class="pills">
            ${npm.map(d=>`<span class="pill pill-npm">${d}</span>`).join('')}
            ${local.map(d=>`<span class="pill pill-local">${d}</span>`).join('')}
          </div>
        </div>` : ''}
        ${s.suggestedNextFiles?.length ? `
        <div class="section">
          <div class="section-label"><i class="ti ti-arrow-right"></i> Read next</div>
          <div class="pills">${s.suggestedNextFiles.map(f=>`<span class="pill pill-local">${f}</span>`).join('')}</div>
        </div>` : ''}`
    }

    case 'explain': {
      const e = cache?.explain
      if (!e) return skeletonHTML(6)
      return `
        <div class="section">
          <div class="section-label"><i class="ti ti-book-2"></i> Line-by-line explanation</div>
          <div class="prose-card">${e.replace(/\n/g, '<br>')}</div>
        </div>`
    }

    case 'graph': {
      const g = cache?.graph
      if (!g) return skeletonHTML(4)
      const { local, npm } = parseDeps(content)
      const currentFile = selectedPath.split('/').pop()
      return `
        <div class="section">
          <div class="section-label"><i class="ti ti-hierarchy-2"></i> Dependency graph</div>
          <div class="graph-wrap">
            <div class="graph-node"><i class="ti ti-file-code"></i><strong>${currentFile}</strong></div>
            ${npm.map(d=>`<div class="graph-edge"><i class="ti ti-package" style="font-size:11px"></i> ${d} <span style="color:var(--muted);font-size:10px">(npm)</span></div>`).join('')}
            ${local.map(d=>`<div class="graph-edge"><i class="ti ti-file" style="font-size:11px"></i> ${d} <span style="color:var(--muted);font-size:10px">(local)</span></div>`).join('')}
          </div>
        </div>
        <div class="section">
          <div class="section-label"><i class="ti ti-sparkles"></i> AI analysis</div>
          <div class="prose-card">${g.replace(/\n/g,'<br>')}</div>
        </div>`
    }

    case 'definitions': {
      const defs = parseDefinitions(content)
      const aiDefs = cache?.definitions
      return `
        <div class="section">
          <div class="section-label"><i class="ti ti-list-details"></i> Symbols (${defs.length})</div>
          ${defs.length ? `<ul class="def-list">${defs.map(d=>`
            <li class="def-item">
              <span class="def-kind def-${d.kind}">${d.kind}</span>
              <span>${d.name}</span>
            </li>`).join('')}</ul>`
          : '<p style="color:var(--muted);font-size:12px">No exported symbols detected.</p>'}
        </div>
        ${aiDefs ? `
        <div class="section">
          <div class="section-label"><i class="ti ti-sparkles"></i> AI definitions</div>
          <div class="prose-card">${aiDefs.replace(/\n/g,'<br>')}</div>
        </div>` : skeletonHTML(2)}`
    }

    case 'onboarding': {
      const o = cache?.onboarding
      if (!o) return skeletonHTML(5)
      return `
        <div class="section">
          <div class="section-label"><i class="ti ti-map"></i> Developer onboarding guide</div>
          <div class="prose-card">${o.replace(/\n/g,'<br>')}</div>
        </div>`
    }

    default: return ''
  }
}

// ── Open in web app ───────────────────────────────────────────────────────────

function openInWebApp() {
  const payload = {
    repoUrl, owner, repo,
    file: selectedPath,
    content: currentContent,
    analysis: tabCache[selectedPath] ?? null,
  }
  localStorage.setItem('repolens_handoff', JSON.stringify(payload))
  window.open(`http://localhost:5173?from=extension`, '_blank')
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
