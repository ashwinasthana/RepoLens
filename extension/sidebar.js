// sidebar.js — RepoLens Chrome Extension sidebar logic

// ── Constants ─────────────────────────────────────────────────────────────────

const EXT_LANG = {
  js:'JavaScript', jsx:'JavaScript', ts:'TypeScript', tsx:'TypeScript',
  py:'Python', rb:'Ruby', go:'Go', rs:'Rust', java:'Java', cs:'C#',
  cpp:'C++', c:'C', php:'PHP', html:'HTML', css:'CSS', json:'JSON',
  md:'Markdown', yml:'YAML', yaml:'YAML', sh:'Shell', sql:'SQL',
  swift:'Swift', kt:'Kotlin', dart:'Dart', lua:'Lua', vue:'Vue',
  svelte:'Svelte', toml:'TOML', xml:'XML',
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
  { id:'code',        icon:'ti-braces',           label:'Code'        },
  { id:'explain',     icon:'ti-book-2',           label:'Explain'     },
  { id:'graph',       icon:'ti-hierarchy-2',      label:'Graph'       },
  { id:'definitions', icon:'ti-list-details',     label:'Definitions' },
  { id:'onboarding',  icon:'ti-map',              label:'Onboarding'  },
]

const KEYWORDS = new Set([
  'import','export','from','default','const','let','var','function','return',
  'if','else','for','while','do','switch','case','break','continue','throw',
  'try','catch','finally','new','delete','typeof','instanceof','void','in','of',
  'class','extends','super','this','async','await','yield','static','get','set',
  'true','false','null','undefined','NaN','Infinity',
])

const HIGHLIGHT_EXTS = new Set(['js','jsx','ts','tsx','py','go','rs','java','cs','cpp','c','php','rb','swift','kt','dart'])

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

function parseExports(content) {
  if (!content) return []
  const found = new Set()
  const patterns = [
    /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g,
    /export\s+\{\s*([^}]+)\}/g,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(content)) !== null) {
      m[1].split(',').forEach(s => {
        const name = s.trim().split(/\s+as\s+/).pop().trim()
        if (name) found.add(name)
      })
    }
  }
  return [...found]
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlightLine(line) {
  const escaped = escapeHtml(line)
  const re = /(\/\/.*$|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|\b\d+\.?\d*\b|\b[a-zA-Z_$][\w$]*\b)/g
  return escaped.replace(re, (match) => {
    if (match.startsWith('//')) return `<span class="tok-comment">${match}</span>`
    if (match.startsWith("'") || match.startsWith('"') || match.startsWith('`'))
      return `<span class="tok-string">${match}</span>`
    if (/^\d/.test(match)) return `<span class="tok-number">${match}</span>`
    if (KEYWORDS.has(match)) return `<span class="tok-keyword">${match}</span>`
    if (/^[A-Z]/.test(match)) return `<span class="tok-type">${match}</span>`
    return match
  })
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

function addToast(message, type = 'error') {
  const container = document.getElementById('toast-container')
  if (!container) return
  const toast = document.createElement('div')
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`
  toast.textContent = message
  container.appendChild(toast)
  setTimeout(() => toast.remove(), 5500)
}

// ── Export report generator ───────────────────────────────────────────────────

function generateReport(file, content, cache) {
  const filename = file.split('/').pop()
  const ext = getExt(filename)
  const lang = EXT_LANG[ext] ?? ext.toUpperCase()
  const lines = content ? content.split('\n').length : 0
  const { local, npm } = parseDeps(content)
  const exports_ = parseExports(content)
  const s = cache?.summary

  let md = `# RepoLens Analysis: ${filename}\n\n`
  md += `| Stat | Value |\n|------|-------|\n`
  md += `| Language | ${lang} |\n`
  md += `| Lines | ${lines} |\n`
  md += `| Complexity | ${s?.complexity ?? '—'} |\n\n`

  if (s?.purpose) md += `## Purpose\n${s.purpose}\n\n`
  if (s?.summary) md += `## Summary\n${s.summary}\n\n`

  if (npm.length || local.length) {
    md += `## Dependencies\n`
    npm.forEach(d => md += `- \`${d}\` (npm)\n`)
    local.forEach(d => md += `- \`${d}\` (local)\n`)
    md += '\n'
  }

  if (exports_.length) {
    md += `## Exports\n`
    exports_.forEach(e => md += `- \`${e}\`\n`)
    md += '\n'
  }

  if (cache?.explain) md += `## Explanation\n${cache.explain}\n\n`
  if (cache?.graph) md += `## Dependency Analysis\n${cache.graph}\n\n`
  if (cache?.definitions) md += `## Definitions\n${cache.definitions}\n\n`
  if (cache?.onboarding) md += `## Onboarding Guide\n${cache.onboarding}\n\n`

  md += `---\n*Generated by [RepoLens](https://github.com/ashwinasthana/RepoLens) — AI-powered repository analyzer*\n`
  return md
}

// ── State ─────────────────────────────────────────────────────────────────────

let owner = '', repo = '', repoContext = '', selectedPath = ''
let currentContent = '', currentNode = null
let activeTab = 'summary'
let tabCache = {}   // { [path]: { summary, explain, graph, definitions, onboarding } }
let allTreeRows = [] // for file search

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
const $treeSearch  = document.getElementById('tree-search')
const $treeSearchClear = document.getElementById('tree-search-clear')

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

// ── File search ───────────────────────────────────────────────────────────────

if ($treeSearch) {
  $treeSearch.addEventListener('input', () => {
    const query = $treeSearch.value.trim().toLowerCase()
    $treeSearchClear.style.display = query ? 'flex' : 'none'

    for (const { el, name, path } of allTreeRows) {
      if (!query) {
        el.classList.remove('hidden')
      } else {
        const match = name.toLowerCase().includes(query) || path.toLowerCase().includes(query)
        el.classList.toggle('hidden', !match)
      }
    }

    // Open all parent folders when searching
    if (query) {
      document.querySelectorAll('.tree-children').forEach(c => c.classList.add('open'))
      document.querySelectorAll('.arrow').forEach(a => a.classList.add('open'))
    }
  })
}

if ($treeSearchClear) {
  $treeSearchClear.addEventListener('click', () => {
    $treeSearch.value = ''
    $treeSearchClear.style.display = 'none'
    for (const { el } of allTreeRows) el.classList.remove('hidden')
  })
}

// ── Chat Widget ───────────────────────────────────────────────────────────────

const $chatFab = document.getElementById('chat-fab')
const $chatWidget = document.getElementById('chat-widget')
const $chatClose = document.getElementById('chat-close')
const $chatForm = document.getElementById('chat-form')
const $chatInput = document.getElementById('chat-input')
const $chatMessages = document.getElementById('chat-messages')
const $chatSendBtn = document.getElementById('chat-send')

let chatLoading = false

if ($chatFab) {
  $chatFab.addEventListener('click', () => {
    $chatFab.style.display = 'none'
    $chatWidget.style.display = 'flex'
    $chatInput.focus()
  })
  
  $chatClose.addEventListener('click', () => {
    $chatWidget.style.display = 'none'
    $chatFab.style.display = 'flex'
  })

  $chatForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (chatLoading) return
    const text = $chatInput.value.trim()
    if (!text) return

    $chatInput.value = ''
    appendChatMsg('user', text)
    chatLoading = true
    $chatSendBtn.disabled = true

    try {
      const context = `Repo: ${repoContext}\nFile selected: ${selectedPath || 'None'}\nContent snippet:\n${currentContent?.slice(0, 1500) || 'N/A'}`
      const answer = await send('CHAT_REPO', { question: text, context })
      appendChatMsg('assistant', answer)
    } catch (err) {
      appendChatMsg('assistant', `Error: ${err.message}`)
    } finally {
      chatLoading = false
      $chatSendBtn.disabled = false
      $chatInput.focus()
    }
  })
}

function appendChatMsg(role, text) {
  const div = document.createElement('div')
  div.className = `chat-msg ${role}`
  
  const avatar = document.createElement('div')
  avatar.className = 'chat-avatar'
  avatar.innerHTML = role === 'user' ? '<i class="ti ti-user"></i>' : '<i class="ti ti-robot"></i>'
  
  const content = document.createElement('div')
  content.className = 'chat-text'
  content.innerHTML = escapeHtml(text).replace(/\n/g, '<br>')
  
  div.appendChild(avatar)
  div.appendChild(content)
  $chatMessages.appendChild(div)
  
  $chatMessages.scrollTop = $chatMessages.scrollHeight
}

// ── Analyze ───────────────────────────────────────────────────────────────────

async function handleAnalyze() {
  if (!owner || !repo) { showError('No repo detected'); return }
  setLoading(true, 'Scanning repository…')
  clearError()
  $analyzeBtn.disabled = true
  tabCache = {}
  allTreeRows = []

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
    
    // Show chat FAB once repo is loaded
    if ($chatFab && $chatWidget.style.display === 'none') {
      $chatFab.style.display = 'flex'
    }
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
  allTreeRows = []
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
    row.innerHTML = `<i class="ti ${fileIconClass(node.name)}"></i><span class="file-name">${escapeHtml(node.name)}</span>`
    row.addEventListener('click', () => handleFileClick(node, row))
    wrap.appendChild(row)
    allTreeRows.push({ el: row, name: node.name, path: node.path })
  } else {
    const row = document.createElement('div')
    row.className = 'tree-row'
    row.style.paddingLeft = indent + 'px'
    row.innerHTML = `<span class="arrow">▸</span><i class="ti ti-folder" style="color:#e3b341"></i><span class="folder-name">${escapeHtml(node.name)}</span>`

    const childWrap = document.createElement('div')
    childWrap.className = 'tree-children'
    for (const child of node.children ?? []) childWrap.appendChild(buildNode(child, depth + 1))

    let open = false
    row.addEventListener('click', () => {
      open = !open
      row.querySelector('.arrow').classList.toggle('open', open)
      const folderIcon = row.querySelector('.ti-folder, .ti-folder-open')
      if (folderIcon) {
        folderIcon.classList.toggle('ti-folder', !open)
        folderIcon.classList.toggle('ti-folder-open', open)
      }
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
    summary:     summary.status     === 'fulfilled' ? summary.value     : { error: summary.reason?.message || 'Failed' },
    explain:     explain.status     === 'fulfilled' ? explain.value     : { error: explain.reason?.message || 'Failed' },
    graph:       graph.status       === 'fulfilled' ? graph.value       : { error: graph.reason?.message || 'Failed' },
    definitions: definitions.status === 'fulfilled' ? definitions.value : { error: definitions.reason?.message || 'Failed' },
    onboarding:  onboarding.status  === 'fulfilled' ? onboarding.value  : { error: onboarding.reason?.message || 'Failed' },
  }

  // Show toast for any failures
  if (summary.status === 'rejected') addToast(`Summary failed: ${summary.reason?.message}`)
  if (explain.status === 'rejected') addToast(`Explain failed: ${explain.reason?.message}`)
  if (graph.status === 'rejected') addToast(`Graph failed: ${graph.reason?.message}`)
  if (definitions.status === 'rejected') addToast(`Definitions failed: ${definitions.reason?.message}`)
  if (onboarding.status === 'rejected') addToast(`Onboarding failed: ${onboarding.reason?.message}`)

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
  const hasExport = cache?.summary && !cache.summary.error

  $detailPanel.innerHTML = `
    <div id="view-tabs">
      ${TABS.map(t => {
        const hasData = t.id === 'code' ? !!content : !!cache?.[t.id]
        return `
        <button class="view-tab ${activeTab===t.id?'active':''}" data-tab="${t.id}">
          <i class="ti ${t.icon}"></i>${t.label}
          ${hasData ? '<i class="ti ti-point-filled tab-dot"></i>' : ''}
        </button>`
      }).join('')}
      ${hasExport ? `<button class="export-btn" id="export-btn"><i class="ti ti-download"></i> Export</button>` : ''}
    </div>
    <div id="tab-content">
      <div class="detail-filename"><i class="ti ti-file-code"></i>${escapeHtml(node.name)}</div>
      <div class="detail-badges">
        <span class="badge">.${ext}</span>
        <span class="badge badge-lang">${lang}</span>
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
      bindTabActions()
    })
  })

  // Export button handler
  const exportBtn = document.getElementById('export-btn')
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const md = generateReport(selectedPath, currentContent, tabCache[selectedPath])
      const blob = new Blob([md], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `repolens-${node.name}.md`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  bindTabActions()
}

// ── Bind copy buttons etc. inside tab content ─────────────────────────────────

function bindTabActions() {
  // Copy code button
  const copyBtn = document.getElementById('copy-code-btn')
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(currentContent).then(() => {
        copyBtn.classList.add('copy-done')
        copyBtn.innerHTML = '<i class="ti ti-check"></i> Copied!'
        setTimeout(() => {
          copyBtn.classList.remove('copy-done')
          copyBtn.innerHTML = '<i class="ti ti-copy"></i> Copy'
        }, 2000)
      })
    })
  }
}

// ── Tab body renderer ─────────────────────────────────────────────────────────

function renderTabBody(tab, content, cache) {
  if (!content && tab !== 'summary') return skeletonHTML(4)

  switch (tab) {

    case 'summary': {
      const s = cache?.summary
      if (!s) return skeletonHTML(3)
      if (s.error) return renderTabError('Summary analysis failed.')
      const { local, npm } = parseDeps(content)
      return `
        ${s.purpose ? `<div class="purpose-line"><i class="ti ti-target"></i> ${escapeHtml(s.purpose)}</div>` : ''}
        <div class="section">
          <div class="section-label"><i class="ti ti-sparkles"></i> What this file does</div>
          <div class="prose-card">${escapeHtml(s.summary || 'No summary available.')}</div>
        </div>
        ${(npm.length||local.length) ? `
        <div class="section">
          <div class="section-label"><i class="ti ti-package"></i> Dependencies</div>
          <div class="pills">
            ${npm.map(d=>`<span class="pill pill-npm">${escapeHtml(d)}</span>`).join('')}
            ${local.map(d=>`<span class="pill pill-local">${escapeHtml(d)}</span>`).join('')}
          </div>
        </div>` : ''}
        ${s.suggestedNextFiles?.length ? `
        <div class="section">
          <div class="section-label"><i class="ti ti-arrow-right"></i> Read next</div>
          <div class="pills">${s.suggestedNextFiles.map(f=>`<span class="pill pill-local">${escapeHtml(f)}</span>`).join('')}</div>
        </div>` : ''}`
    }

    case 'code': {
      if (!content) return skeletonHTML(8)
      const lines = content.split('\n')
      const ext = getExt(selectedPath.split('/').pop())
      const shouldHighlight = HIGHLIGHT_EXTS.has(ext)
      const lineNumsHtml = lines.map((_, i) => `<span>${i + 1}</span>`).join('')
      const codeHtml = shouldHighlight
        ? lines.map(l => highlightLine(l)).join('\n')
        : escapeHtml(content)

      return `
        <div class="code-header">
          <span class="code-filename"><i class="ti ti-file-code"></i> ${escapeHtml(selectedPath.split('/').pop())}</span>
          <div class="code-actions">
            <span class="code-line-count">${lines.length} lines</span>
            <button class="copy-btn" id="copy-code-btn"><i class="ti ti-copy"></i> Copy</button>
          </div>
        </div>
        <div class="code-container">
          <div class="line-numbers">${lineNumsHtml}</div>
          <pre class="code-block"><code>${codeHtml}</code></pre>
        </div>`
    }

    case 'explain': {
      const e = cache?.explain
      if (!e) return skeletonHTML(6)
      if (typeof e === 'object' && e.error) return renderTabError(e.error)
      return `
        <div class="section">
          <div class="section-label"><i class="ti ti-book-2"></i> Line-by-line explanation</div>
          <div class="prose-card">${escapeHtml(e).replace(/\n/g, '<br>')}</div>
        </div>`
    }

    case 'graph': {
      const g = cache?.graph
      if (!g) return skeletonHTML(4)
      if (typeof g === 'object' && g.error) return renderTabError(g.error)
      const { local, npm } = parseDeps(content)
      const currentFile = selectedPath.split('/').pop()
      return `
        <div class="section">
          <div class="section-label"><i class="ti ti-hierarchy-2"></i> Dependency graph</div>
          <div class="graph-wrap">
            <div class="graph-node graph-node-center"><i class="ti ti-file-code"></i><strong>${escapeHtml(currentFile)}</strong></div>
            ${npm.map(d=>`<div class="graph-edge graph-edge-npm"><i class="ti ti-package" style="font-size:11px"></i> ${escapeHtml(d)} <span style="color:var(--muted);font-size:10px">(npm)</span></div>`).join('')}
            ${local.map(d=>`<div class="graph-edge graph-edge-local"><i class="ti ti-file" style="font-size:11px"></i> ${escapeHtml(d)} <span style="color:var(--muted);font-size:10px">(local)</span></div>`).join('')}
          </div>
        </div>
        <div class="section">
          <div class="section-label"><i class="ti ti-sparkles"></i> AI analysis</div>
          <div class="prose-card">${escapeHtml(g).replace(/\n/g,'<br>')}</div>
        </div>`
    }

    case 'definitions': {
      const defs = parseDefinitions(content)
      const aiDefs = cache?.definitions
      const aiDefsIsError = typeof aiDefs === 'object' && aiDefs !== null && aiDefs.error
      return `
        <div class="section">
          <div class="section-label"><i class="ti ti-list-details"></i> Symbols (${defs.length})</div>
          ${defs.length ? `<ul class="def-list">${defs.map(d=>`
            <li class="def-item">
              <span class="def-kind def-${d.kind}">${d.kind}</span>
              <span>${escapeHtml(d.name)}</span>
            </li>`).join('')}</ul>`
          : '<p style="color:var(--muted);font-size:12px">No exported symbols detected.</p>'}
        </div>
        ${!aiDefs ? skeletonHTML(2) : aiDefsIsError ? renderTabError(aiDefs.error) : `
        <div class="section">
          <div class="section-label"><i class="ti ti-sparkles"></i> AI definitions</div>
          <div class="prose-card">${escapeHtml(aiDefs).replace(/\n/g,'<br>')}</div>
        </div>`}`
    }

    case 'onboarding': {
      const o = cache?.onboarding
      if (!o) return skeletonHTML(5)
      if (typeof o === 'object' && o.error) return renderTabError(o.error)
      return `
        <div class="section">
          <div class="section-label"><i class="ti ti-map"></i> Developer onboarding guide</div>
          <div class="prose-card">${escapeHtml(o).replace(/\n/g,'<br>')}</div>
        </div>`
    }

    default: return ''
  }
}

// ── Error state renderer ──────────────────────────────────────────────────────

function renderTabError(message) {
  return `
    <div class="tab-error-state">
      <div class="tab-error-icon"><i class="ti ti-alert-circle"></i></div>
      <p class="tab-error-msg">${escapeHtml(message || 'Analysis failed.')}</p>
      <p class="tab-error-hint">Check your Groq API key or try again in a moment.</p>
    </div>`
}

// ── Open in web app ───────────────────────────────────────────────────────────

function openInWebApp() {
  let url = `http://localhost:5173/?repoUrl=${encodeURIComponent(repoUrl)}`
  if (selectedPath) {
    url += `&file=${encodeURIComponent(selectedPath)}`
  }
  window.open(url, '_blank')
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
