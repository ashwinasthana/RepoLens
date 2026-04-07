import { useState } from 'react'
import {
  IconFolders, IconChartDots3, IconBook, IconRocket,
  IconSparkles, IconPackage, IconArrowRight, IconFunction,
  IconCopy, IconCheck, IconDoorEnter, IconFileCode,
  IconLineHeight, IconArchive, IconCode, IconGauge,
  IconCircleFilled, IconArrowNarrowRight, IconBulb,
  IconAlertTriangle, IconListCheck, IconTarget,
  IconSchool, IconTools, IconRoute, IconBrain,
  IconDownload, IconBraces, IconAlertCircle,
  IconRefresh, IconExternalLink,
} from '@tabler/icons-react'
import WelcomeScreen from './WelcomeScreen'
import styles from './MainPanel.module.css'

// ── Helpers ──────────────────────────────────────────────────────────────────

const EXT_LANG = {
  js: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
  py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java', cs: 'C#',
  cpp: 'C++', c: 'C', php: 'PHP', html: 'HTML', css: 'CSS', scss: 'SCSS',
  json: 'JSON', md: 'Markdown', yml: 'YAML', yaml: 'YAML', sh: 'Shell', sql: 'SQL',
  swift: 'Swift', kt: 'Kotlin', dart: 'Dart', lua: 'Lua', r: 'R',
  vue: 'Vue', svelte: 'Svelte', toml: 'TOML', xml: 'XML',
}
const ENTRY_NAMES = new Set(['index.js','index.jsx','index.ts','index.tsx','main.py','app.js','app.jsx','app.ts','app.tsx','main.js','main.ts'])

function getExt(filename) { return filename.split('.').pop().toLowerCase() }

function parseDeps(content) {
  if (!content) return { local: [], npm: [] }
  const found = new Set()
  const re = /(?:import\s+(?:.*?\s+from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(content)) !== null) found.add(m[1])
  const local = [], npm = []
  for (const dep of found) (dep.startsWith('.') ? local : npm).push(dep)
  return { local, npm }
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

// ── Syntax highlighting helper ───────────────────────────────────────────────

const KEYWORDS = new Set([
  'import','export','from','default','const','let','var','function','return',
  'if','else','for','while','do','switch','case','break','continue','throw',
  'try','catch','finally','new','delete','typeof','instanceof','void','in','of',
  'class','extends','super','this','async','await','yield','static','get','set',
  'true','false','null','undefined','NaN','Infinity',
])

function highlightLine(line) {
  const tokens = []
  // Regex to split by strings, comments, numbers, keywords/identifiers, and operators
  const re = /(\/\/.*$|\/\*[\s\S]*?\*\/|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|\b\d+\.?\d*\b|\b[a-zA-Z_$][\w$]*\b|[^\s\w])/g
  let match
  let lastIndex = 0

  while ((match = re.exec(line)) !== null) {
    // Add any whitespace/gap before this token
    if (match.index > lastIndex) {
      tokens.push({ type: 'plain', text: line.slice(lastIndex, match.index) })
    }

    const text = match[0]
    let type = 'plain'

    if (text.startsWith('//') || text.startsWith('/*')) {
      type = 'comment'
    } else if (text.startsWith("'") || text.startsWith('"') || text.startsWith('`')) {
      type = 'string'
    } else if (/^\d/.test(text)) {
      type = 'number'
    } else if (KEYWORDS.has(text)) {
      type = 'keyword'
    } else if (/^[A-Z]/.test(text)) {
      type = 'type'
    } else if (/^[a-zA-Z_$]/.test(text)) {
      type = 'ident'
    } else {
      type = 'punct'
    }

    tokens.push({ type, text })
    lastIndex = re.lastIndex
  }

  if (lastIndex < line.length) {
    tokens.push({ type: 'plain', text: line.slice(lastIndex) })
  }

  return tokens
}

// ── Shared sub-components ────────────────────────────────────────────────────

function Skeleton({ rows = 3 }) {
  const sizes = [styles.skLong, styles.skMed, styles.skShort]
  return (
    <div className={styles.skeletonWrap}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`${styles.skeleton} ${sizes[i % 3]}`} />
      ))}
    </div>
  )
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <p className={styles.sectionLabel}>
      {Icon && <Icon size={13} stroke={1.8} />}
      {children}
    </p>
  )
}

function Pill({ children, variant = 'npm' }) {
  return <span className={`${styles.pill} ${variant === 'local' ? styles.pillLocal : styles.pillNpm}`}>{children}</span>
}

// ── Tabs config ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'summary',     icon: IconFolders,    label: 'Summary' },
  { id: 'code',        icon: IconBraces,     label: 'Code' },
  { id: 'graph',       icon: IconChartDots3, label: 'Graph' },
  { id: 'definitions', icon: IconBook,       label: 'Definitions' },
  { id: 'onboarding',  icon: IconRocket,     label: 'Onboarding' },
]

// ── Export helper ────────────────────────────────────────────────────────────

function generateReport(file, content, analysis) {
  const filename = file.split('/').pop()
  const ext = getExt(filename)
  const lang = EXT_LANG[ext] ?? ext.toUpperCase()
  const lines = content ? content.split('\n').length : 0
  const { local, npm } = parseDeps(content)
  const exports_ = parseExports(content)
  const s = analysis?.summary
  const g = analysis?.graph
  const d = analysis?.definitions
  const o = analysis?.onboarding

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

  if (g?.architectureRole) md += `## Architecture Role\n${g.architectureRole}\n\n`
  if (g?.dataFlow) md += `## Data Flow\n${g.dataFlow}\n\n`

  if (d?.definitions?.length) {
    md += `## Definitions\n`
    d.definitions.forEach(def => {
      md += `### \`${def.name}\` (${def.kind})\n`
      if (def.description) md += `${def.description}\n`
      if (def.params) md += `- **Params:** \`${def.params}\`\n`
      if (def.returns) md += `- **Returns:** \`${def.returns}\`\n`
      md += '\n'
    })
  }

  if (o?.whatItSolves) md += `## What It Solves\n${o.whatItSolves}\n\n`
  if (o?.pitfalls?.length) {
    md += `## Pitfalls\n`
    o.pitfalls.forEach(p => md += `- ⚠️ **${p.issue}** — ${p.prevention}\n`)
    md += '\n'
  }

  md += `---\n*Generated by [RepoLens](https://github.com/ashwinasthana/RepoLens) — AI-powered repository analyzer*\n`
  return md
}

// ── SUMMARY TAB ──────────────────────────────────────────────────────────────

function SummaryTab({ file, content, analysis }) {
  const [copied, setCopied] = useState(false)
  const filename = file.split('/').pop()
  const ext = getExt(filename)
  const lang = EXT_LANG[ext] ?? ext.toUpperCase()
  const isEntry = ENTRY_NAMES.has(filename)
  const lines = content ? content.split('\n').length : 0
  const kb = content ? (new Blob([content]).size / 1024).toFixed(1) : '0.0'
  const { local, npm } = parseDeps(content)
  const exports_ = parseExports(content)
  const summary = analysis?.summary
  const isLoading = !summary || summary?.loading
  const hasError = summary?.error

  function handleCopy() {
    const text = summary?.summary || ''
    if (!text) return
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div className={styles.tabContent}>
      {/* Header */}
      <div className={styles.fileHeader}>
        <IconFileCode size={18} stroke={1.5} className={styles.headerIcon} />
        <span className={styles.filename}>{filename}</span>
        <span className={styles.extBadge}>.{ext}</span>
        {isEntry && <span className={styles.entryBadge}><IconDoorEnter size={12} stroke={2} /> Entry point</span>}
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.card}>
          <span className={styles.cardIcon}><IconLineHeight size={16} stroke={1.5} /></span>
          <span className={styles.cardVal}>{lines.toLocaleString()}</span>
          <span className={styles.cardKey}>Lines</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardIcon}><IconArchive size={16} stroke={1.5} /></span>
          <span className={styles.cardVal}>{kb} KB</span>
          <span className={styles.cardKey}>Size</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardIcon}><IconCode size={16} stroke={1.5} /></span>
          <span className={styles.cardVal}>{lang}</span>
          <span className={styles.cardKey}>Language</span>
        </div>
        {summary?.complexity && (
          <div className={styles.card}>
            <span className={styles.cardIcon}><IconGauge size={16} stroke={1.5} /></span>
            <span className={styles.cardVal} style={{ textTransform: 'capitalize' }}>{summary.complexity}</span>
            <span className={styles.cardKey}>Complexity</span>
          </div>
        )}
      </div>

      {/* AI Summary */}
      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <SectionLabel icon={IconSparkles}>What this file does</SectionLabel>
          {!isLoading && summary?.summary && !hasError && (
            <button className={`${styles.copyBtn} ${copied ? styles.copyDone : ''}`} onClick={handleCopy}>
              {copied ? <><IconCheck size={13} stroke={2} /> Copied!</> : <><IconCopy size={13} stroke={1.5} /> Copy</>}
            </button>
          )}
        </div>
        <div className={styles.proseCard}>
          {isLoading ? <Skeleton /> : hasError ? (
            <div className={styles.inlineError}>
              <IconAlertCircle size={14} stroke={1.5} />
              <span>Analysis failed — try again or check your API key</span>
            </div>
          ) : (
            <>
              {summary?.purpose && <p className={styles.purposeText}><IconTarget size={13} stroke={1.8} /> {summary.purpose}</p>}
              <p className={styles.proseText}>{summary?.summary || <span className={styles.muted}>No summary available.</span>}</p>
            </>
          )}
        </div>
      </section>

      {/* Dependencies */}
      <section className={styles.section}>
        <SectionLabel icon={IconPackage}>Dependencies</SectionLabel>
        {local.length === 0 && npm.length === 0
          ? <p className={styles.muted}>None detected.</p>
          : <div className={styles.pillGroup}>
              {npm.map(d => <Pill key={d}>{d}</Pill>)}
              {local.map(d => <Pill key={d} variant="local">{d}</Pill>)}
            </div>
        }
      </section>

      {/* Key Exports */}
      <section className={styles.section}>
        <SectionLabel icon={IconFunction}>Key exports</SectionLabel>
        {exports_.length === 0
          ? <p className={styles.muted}>None detected.</p>
          : <ul className={styles.defList}>
              {exports_.map(e => (
                <li key={e} className={styles.defItem}>
                  <IconFunction size={13} stroke={1.5} className={styles.defIcon} /> {e}
                </li>
              ))}
            </ul>
        }
      </section>

      {/* Read Next */}
      {summary?.suggestedNextFiles?.length > 0 && (
        <section className={styles.section}>
          <SectionLabel icon={IconArrowRight}>Read next</SectionLabel>
          <div className={styles.pillGroup}>
            {summary.suggestedNextFiles.map(f => <Pill key={f} variant="local">{f}</Pill>)}
          </div>
        </section>
      )}
    </div>
  )
}

// ── GRAPH TAB ────────────────────────────────────────────────────────────────

function GraphTab({ file, content, analysis }) {
  const graphData = analysis?.graph
  const isLoading = !graphData || graphData?.loading
  const hasError = graphData?.error
  const filename = file.split('/').pop()
  const { local, npm } = parseDeps(content)

  if (isLoading) return <div className={styles.tabContent}><Skeleton rows={6} /></div>

  if (hasError) return (
    <div className={styles.tabContent}>
      <TabError message="Graph analysis failed. The AI might be rate-limited." />
    </div>
  )

  return (
    <div className={styles.tabContent}>
      {/* Architecture Role */}
      {graphData.architectureRole && (
        <section className={styles.section}>
          <SectionLabel icon={IconBrain}>Architecture role</SectionLabel>
          <div className={styles.proseCard}>
            <p className={styles.proseText}>{graphData.architectureRole}</p>
          </div>
        </section>
      )}

      {/* Data Flow */}
      {graphData.dataFlow && (
        <section className={styles.section}>
          <SectionLabel icon={IconRoute}>Data flow</SectionLabel>
          <div className={styles.proseCard}>
            <p className={styles.proseText}>{graphData.dataFlow}</p>
          </div>
        </section>
      )}

      {/* Visual Dependency Graph */}
      <section className={styles.section}>
        <SectionLabel icon={IconChartDots3}>Dependency graph</SectionLabel>
        <div className={styles.graphContainer}>
          {/* Importers (who depends on this file) */}
          {graphData.likelyImportedBy?.length > 0 && (
            <div className={styles.graphColumn}>
              <span className={styles.graphColLabel}>Imported by</span>
              {graphData.likelyImportedBy.map(f => (
                <div key={f} className={styles.graphNode}>
                  <IconFileCode size={14} stroke={1.5} /> {f}
                </div>
              ))}
            </div>
          )}

          {/* Center node — current file */}
          <div className={styles.graphColumn}>
            {graphData.likelyImportedBy?.length > 0 && (
              <div className={styles.graphArrows}>
                {graphData.likelyImportedBy.map((_, i) => (
                  <IconArrowNarrowRight key={i} size={18} className={styles.graphArrow} />
                ))}
              </div>
            )}
            <div className={`${styles.graphNode} ${styles.graphNodeCenter}`}>
              <IconFileCode size={16} stroke={2} /> <strong>{filename}</strong>
            </div>
            {(graphData.imports?.length > 0 || npm.length > 0 || local.length > 0) && (
              <div className={styles.graphArrows}>
                <IconArrowNarrowRight size={18} className={styles.graphArrow} />
              </div>
            )}
          </div>

          {/* Imports (what this file depends on) */}
          <div className={styles.graphColumn}>
            <span className={styles.graphColLabel}>Imports</span>
            {(graphData.imports || []).map(imp => (
              <div key={imp.module} className={`${styles.graphNode} ${imp.type === 'npm' ? styles.graphNodeNpm : styles.graphNodeLocal}`}>
                <IconPackage size={13} stroke={1.5} />
                <span>{imp.module}</span>
                <span className={styles.graphNodeType}>{imp.type}</span>
              </div>
            ))}
            {/* Fallback to static parsing if AI didn't return imports */}
            {(!graphData.imports || graphData.imports.length === 0) && (
              <>
                {npm.map(d => (
                  <div key={d} className={`${styles.graphNode} ${styles.graphNodeNpm}`}>
                    <IconPackage size={13} stroke={1.5} /> {d}
                    <span className={styles.graphNodeType}>npm</span>
                  </div>
                ))}
                {local.map(d => (
                  <div key={d} className={`${styles.graphNode} ${styles.graphNodeLocal}`}>
                    <IconFileCode size={13} stroke={1.5} /> {d}
                    <span className={styles.graphNodeType}>local</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Import Details */}
      {graphData.imports?.length > 0 && (
        <section className={styles.section}>
          <SectionLabel icon={IconPackage}>Import details</SectionLabel>
          <div className={styles.importTable}>
            <div className={styles.importHeader}>
              <span>Module</span>
              <span>Type</span>
              <span>Used for</span>
            </div>
            {graphData.imports.map(imp => (
              <div key={imp.module} className={styles.importRow}>
                <span className={styles.importModule}>{imp.module}</span>
                <span className={`${styles.importType} ${imp.type === 'npm' ? styles.pillNpm : styles.pillLocal}`}>{imp.type}</span>
                <span className={styles.importUsage}>{imp.usedFor}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── DEFINITIONS TAB ──────────────────────────────────────────────────────────

const KIND_COLORS = {
  function:  '#d2a8ff',
  hook:      '#f778ba',
  component: '#79c0ff',
  class:     '#ffa657',
  const:     '#7ee787',
  type:      '#ff7b72',
  interface: '#ff7b72',
}

function DefinitionsTab({ file, content, analysis }) {
  const defsData = analysis?.definitions
  const isLoading = !defsData || defsData?.loading
  const hasError = defsData?.error
  const localExports = parseExports(content)

  if (isLoading) return <div className={styles.tabContent}><Skeleton rows={6} /></div>

  if (hasError) return (
    <div className={styles.tabContent}>
      <TabError message="Definitions analysis failed. The AI might be rate-limited." />
    </div>
  )

  const defs = defsData.definitions || []
  const patterns = defsData.patterns || []

  return (
    <div className={styles.tabContent}>
      {/* Overview */}
      <div className={styles.defsOverview}>
        <div className={styles.card}>
          <span className={styles.cardVal}>{defs.length}</span>
          <span className={styles.cardKey}>Symbols</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardVal}>{defs.filter(d => d.isExported).length}</span>
          <span className={styles.cardKey}>Exported</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardVal} style={{ textTransform: 'capitalize' }}>{defsData.totalComplexity || '—'}</span>
          <span className={styles.cardKey}>Complexity</span>
        </div>
      </div>

      {/* Patterns */}
      {patterns.length > 0 && (
        <section className={styles.section}>
          <SectionLabel icon={IconBrain}>Design patterns</SectionLabel>
          <div className={styles.pillGroup}>
            {patterns.map(p => <Pill key={p} variant="local">{p}</Pill>)}
          </div>
        </section>
      )}

      {/* Definitions List */}
      <section className={styles.section}>
        <SectionLabel icon={IconListCheck}>All definitions ({defs.length})</SectionLabel>
        {defs.length === 0
          ? <p className={styles.muted}>No definitions found.</p>
          : <div className={styles.defsGrid}>
              {defs.map(d => (
                <div key={d.name} className={styles.defCard}>
                  <div className={styles.defCardHeader}>
                    <span className={styles.defKind} style={{ background: (KIND_COLORS[d.kind] || '#8b949e') + '22', color: KIND_COLORS[d.kind] || '#8b949e' }}>
                      {d.kind}
                    </span>
                    <span className={styles.defName}>{d.name}</span>
                    {d.isExported && <span className={styles.defExported}>exported</span>}
                  </div>
                  {d.description && <p className={styles.defDesc}>{d.description}</p>}
                  {d.params && (
                    <div className={styles.defMeta}>
                      <span className={styles.defMetaLabel}>Params</span>
                      <code className={styles.defMetaCode}>{d.params}</code>
                    </div>
                  )}
                  {d.returns && (
                    <div className={styles.defMeta}>
                      <span className={styles.defMetaLabel}>Returns</span>
                      <code className={styles.defMetaCode}>{d.returns}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
        }
      </section>

      {/* Static exports fallback */}
      {localExports.length > 0 && (
        <section className={styles.section}>
          <SectionLabel icon={IconFunction}>Static export scan</SectionLabel>
          <div className={styles.pillGroup}>
            {localExports.map(e => <Pill key={e} variant="local">{e}</Pill>)}
          </div>
        </section>
      )}
    </div>
  )
}

// ── ONBOARDING TAB ───────────────────────────────────────────────────────────

function OnboardingTab({ file, analysis }) {
  const data = analysis?.onboarding
  const isLoading = !data || data?.loading
  const hasError = data?.error

  if (isLoading) return <div className={styles.tabContent}><Skeleton rows={8} /></div>

  if (hasError) return (
    <div className={styles.tabContent}>
      <TabError message="Onboarding analysis failed. The AI might be rate-limited." />
    </div>
  )

  return (
    <div className={styles.tabContent}>
      {/* What it solves */}
      {data.whatItSolves && (
        <section className={styles.section}>
          <SectionLabel icon={IconTarget}>What this file solves</SectionLabel>
          <div className={styles.proseCard}>
            <p className={styles.proseText}>{data.whatItSolves}</p>
          </div>
        </section>
      )}

      {/* Prerequisites */}
      {data.prerequisites?.length > 0 && (
        <section className={styles.section}>
          <SectionLabel icon={IconSchool}>Prerequisites</SectionLabel>
          <div className={styles.pillGroup}>
            {data.prerequisites.map(p => <Pill key={p} variant="npm">{p}</Pill>)}
          </div>
        </section>
      )}

      {/* Key Concepts */}
      {data.keyConcepts?.length > 0 && (
        <section className={styles.section}>
          <SectionLabel icon={IconBulb}>Key concepts</SectionLabel>
          <div className={styles.conceptGrid}>
            {data.keyConcepts.map(c => (
              <div key={c.concept} className={styles.conceptCard}>
                <div className={styles.conceptName}>
                  <IconBulb size={14} stroke={1.5} /> {c.concept}
                </div>
                <p className={styles.conceptDesc}>{c.explanation}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* How to Modify */}
      {data.howToModify?.length > 0 && (
        <section className={styles.section}>
          <SectionLabel icon={IconTools}>How to modify</SectionLabel>
          <div className={styles.modifyList}>
            {data.howToModify.map((m, i) => (
              <div key={i} className={styles.modifyItem}>
                <div className={styles.modifyScenario}>
                  <IconArrowNarrowRight size={14} stroke={2} /> {m.scenario}
                </div>
                <p className={styles.modifySteps}>{m.steps}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pitfalls */}
      {data.pitfalls?.length > 0 && (
        <section className={styles.section}>
          <SectionLabel icon={IconAlertTriangle}>Common pitfalls</SectionLabel>
          <div className={styles.pitfallList}>
            {data.pitfalls.map((p, i) => (
              <div key={i} className={styles.pitfallItem}>
                <div className={styles.pitfallIssue}>
                  <IconAlertTriangle size={14} stroke={1.8} /> {p.issue}
                </div>
                <p className={styles.pitfallFix}>{p.prevention}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reading Order */}
      {data.readingOrder?.length > 0 && (
        <section className={styles.section}>
          <SectionLabel icon={IconRoute}>Suggested reading order</SectionLabel>
          <ol className={styles.readingOrder}>
            {data.readingOrder.map((f, i) => (
              <li key={i} className={styles.readingItem}>
                <span className={styles.readingNum}>{i + 1}</span>
                <span>{f}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

// ── CODE TAB ─────────────────────────────────────────────────────────────────

function CodeTab({ file, content }) {
  const [copied, setCopied] = useState(false)
  const filename = file.split('/').pop()
  const ext = getExt(filename)
  const lang = EXT_LANG[ext] ?? ext.toUpperCase()
  const lines = content ? content.split('\n') : []
  const shouldHighlight = ['js','jsx','ts','tsx','py','go','rs','java','cs','cpp','c','php','rb','swift','kt','dart'].includes(ext)

  function handleCopyAll() {
    if (!content) return
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!content) return <div className={styles.tabContent}><Skeleton rows={12} /></div>

  return (
    <div className={styles.tabContent}>
      <div className={styles.codeHeader}>
        <span className={styles.codeFilename}>
          <IconFileCode size={14} stroke={1.5} /> {filename}
          <span className={styles.codeLang}>{lang}</span>
        </span>
        <div className={styles.codeActions}>
          <span className={styles.codeLineCount}>{lines.length} lines</span>
          <button className={`${styles.copyBtn} ${copied ? styles.copyDone : ''}`} onClick={handleCopyAll}>
            {copied ? <><IconCheck size={13} stroke={2} /> Copied!</> : <><IconCopy size={13} stroke={1.5} /> Copy</>}
          </button>
        </div>
      </div>
      <div className={styles.codeContainer}>
        <div className={styles.lineNumbers}>
          {lines.map((_, i) => <span key={i}>{i + 1}</span>)}
        </div>
        <pre className={styles.codeBlock}>
          <code>
            {shouldHighlight ? lines.map((line, i) => (
              <div key={i} className={styles.codeLine}>
                {highlightLine(line).map((tok, j) => (
                  <span key={j} className={styles[`tok_${tok.type}`] || ''}>{tok.text}</span>
                ))}
                {'\n'}
              </div>
            )) : content}
          </code>
        </pre>
      </div>
    </div>
  )
}

// ── ERROR STATE ──────────────────────────────────────────────────────────────

function TabError({ message, onRetry }) {
  return (
    <div className={styles.tabError}>
      <div className={styles.tabErrorIcon}>
        <IconAlertCircle size={28} stroke={1.5} />
      </div>
      <p className={styles.tabErrorMsg}>{message || 'Analysis failed. The AI might be rate-limited.'}</p>
      <p className={styles.tabErrorHint}>Check your Groq API key or try again in a moment.</p>
      {onRetry && (
        <button className={styles.retryBtn} onClick={onRetry}>
          <IconRefresh size={14} stroke={2} /> Retry Analysis
        </button>
      )}
    </div>
  )
}

// ── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyState({ hasRepo }) {
  if (!hasRepo) return <WelcomeScreen />
  return (
    <div className={styles.empty}>
      <div className={styles.emptyGlow} />
      <IconFolders size={48} stroke={1} className={styles.emptyIcon} />
      <h3 className={styles.emptyTitle}>No file selected</h3>
      <p className={styles.emptyText}>Click any file in the sidebar to explore its code, dependencies, and AI-powered analysis.</p>
    </div>
  )
}

// ── MAIN PANEL ───────────────────────────────────────────────────────────────

export default function MainPanel({ selectedFile, fileContent, analysis, hasRepo, onRetryAnalysis }) {
  const [activeTab, setActiveTab] = useState('summary')

  function handleExport() {
    if (!selectedFile || !fileContent) return
    const md = generateReport(selectedFile, fileContent, analysis)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `repolens-${selectedFile.split('/').pop()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!selectedFile) {
    return (
      <div className={styles.panel}>
        {hasRepo && (
          <div className={styles.tabBar}>
            {TABS.map(tab => {
              const Icon = tab.icon
              return (
                <button key={tab.id} className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`} onClick={() => setActiveTab(tab.id)}>
                  <Icon size={15} stroke={1.5} /> {tab.label}
                </button>
              )
            })}
          </div>
        )}
        <div className={styles.content}><EmptyState hasRepo={hasRepo} /></div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.tabBar}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const hasData = tab.id === 'code' ? !!fileContent : !!analysis?.[tab.id]
          const hasError = tab.id !== 'code' && analysis?.[tab.id]?.error
          return (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''} ${hasError ? styles.tabError_ : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} stroke={1.5} />
              {tab.label}
              {hasData && !hasError && <IconCircleFilled size={6} className={styles.tabDot} />}
              {hasError && <IconAlertCircle size={12} className={styles.tabErrorDot} />}
            </button>
          )
        })}
        {/* Export button */}
        {analysis?.summary && !analysis.summary.error && (
          <button className={styles.exportBtn} onClick={handleExport} title="Export analysis as Markdown">
            <IconDownload size={14} stroke={1.5} /> Export
          </button>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.tabPane}>
          {activeTab === 'summary' && <SummaryTab file={selectedFile} content={fileContent} analysis={analysis} />}
          {activeTab === 'code' && <CodeTab file={selectedFile} content={fileContent} />}
          {activeTab === 'graph' && <GraphTab file={selectedFile} content={fileContent} analysis={analysis} />}
          {activeTab === 'definitions' && <DefinitionsTab file={selectedFile} content={fileContent} analysis={analysis} />}
          {activeTab === 'onboarding' && <OnboardingTab file={selectedFile} analysis={analysis} />}
        </div>
      </div>
    </div>
  )
}
