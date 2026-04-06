import { useState } from 'react'
import {
  IconSparkles, IconPackage, IconArrowRight, IconFunction,
  IconCopy, IconCheck, IconDoorEnter, IconFileCode,
  IconLines, IconFileZip, IconCode, IconGauge,
} from '@tabler/icons-react'
import styles from './FileDetail.module.css'

// ── Helpers ──────────────────────────────────────────────────────────────────

const EXT_LANG = {
  js: 'JavaScript', jsx: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript',
  py: 'Python', rb: 'Ruby', go: 'Go',
  rs: 'Rust', java: 'Java', cs: 'C#',
  cpp: 'C++', c: 'C', php: 'PHP',
  html: 'HTML', css: 'CSS', scss: 'SCSS',
  json: 'JSON', md: 'Markdown', yml: 'YAML', yaml: 'YAML',
  sh: 'Shell', sql: 'SQL',
}

const ENTRY_NAMES = new Set(['index.js', 'index.jsx', 'index.ts', 'index.tsx', 'main.py', 'app.js', 'app.jsx', 'app.ts', 'app.tsx', 'main.js', 'main.ts'])

function getExt(filename) {
  return filename.split('.').pop().toLowerCase()
}

function parseDeps(content) {
  if (!content) return { local: [], npm: [] }
  const found = new Set()
  const re = /(?:import\s+(?:.*?\s+from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(content)) !== null) found.add(m[1])
  const local = [], npm = []
  for (const dep of found) {
    if (dep.startsWith('.')) local.push(dep)
    else npm.push(dep)
  }
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

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, children }) {
  return (
    <p className={styles.label}>
      {Icon && <Icon size={13} stroke={1.8} />}
      {children}
    </p>
  )
}

function Skeleton() {
  return (
    <div className={styles.skeletonWrap}>
      <div className={`${styles.skeleton} ${styles.skLong}`} />
      <div className={`${styles.skeleton} ${styles.skMed}`} />
      <div className={`${styles.skeleton} ${styles.skShort}`} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FileDetail({ file, content, summary, fileSummary, isLoading }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const text = summary || fileSummary?.summary || ''
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  if (!file) return null

  const filename = file.split('/').pop()
  const ext = getExt(filename)
  const lang = EXT_LANG[ext] ?? ext.toUpperCase()
  const isEntry = ENTRY_NAMES.has(filename)

  const lines = content ? content.split('\n').length : 0
  const kb = content ? (new Blob([content]).size / 1024).toFixed(1) : '0.0'

  const { local, npm } = parseDeps(content)
  const exports_ = parseExports(content)

  return (
    <div className={styles.wrap}>

      {/* 1 ── Header */}
      <div className={styles.header}>
        <IconFileCode size={18} stroke={1.5} className={styles.headerIcon} />
        <span className={styles.filename}>{filename}</span>
        <span className={styles.extBadge}>.{ext}</span>
        {isEntry && (
          <span className={styles.entryBadge}>
            <IconDoorEnter size={12} stroke={2} />
            Entry point
          </span>
        )}
      </div>

      {/* 2 ── Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.card}>
          <span className={styles.cardIcon}><IconLines size={16} stroke={1.5} /></span>
          <span className={styles.cardVal}>{lines.toLocaleString()}</span>
          <span className={styles.cardKey}>Lines</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardIcon}><IconFileZip size={16} stroke={1.5} /></span>
          <span className={styles.cardVal}>{kb} KB</span>
          <span className={styles.cardKey}>Size</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardIcon}><IconCode size={16} stroke={1.5} /></span>
          <span className={styles.cardVal}>{lang}</span>
          <span className={styles.cardKey}>Language</span>
        </div>
        {fileSummary?.complexity && (
          <div className={styles.card}>
            <span className={styles.cardIcon}><IconGauge size={16} stroke={1.5} /></span>
            <span className={styles.cardVal} style={{ textTransform: 'capitalize' }}>{fileSummary.complexity}</span>
            <span className={styles.cardKey}>Complexity</span>
          </div>
        )}
      </div>

      {/* 3 ── AI summary */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <SectionLabel icon={IconSparkles}>What this file does</SectionLabel>
          {!isLoading && (summary || fileSummary?.summary) && (
            <button className={`${styles.copyBtn} ${copied ? styles.copyDone : ''}`} onClick={handleCopy}>
              {copied
                ? <><IconCheck size={13} stroke={2} /> Copied!</>
                : <><IconCopy size={13} stroke={1.5} /> Copy summary</>
              }
            </button>
          )}
        </div>
        <div className={styles.summaryCard}>
          {isLoading ? <Skeleton /> : (
            <>
              {fileSummary?.purpose && (
                <p className={styles.purposeText}>{fileSummary.purpose}</p>
              )}
              <p className={styles.summaryText}>
                {summary || <span className={styles.muted}>No summary available.</span>}
              </p>
            </>
          )}
        </div>
      </section>

      {/* 4 ── Dependencies */}
      <section className={styles.section}>
        <SectionLabel icon={IconPackage}>Dependencies</SectionLabel>
        {local.length === 0 && npm.length === 0
          ? <p className={styles.muted}>None detected.</p>
          : (
            <div className={styles.pillGroup}>
              {npm.map(d => <span key={d} className={`${styles.pill} ${styles.pillNpm}`}>{d}</span>)}
              {local.map(d => <span key={d} className={`${styles.pill} ${styles.pillLocal}`}>{d}</span>)}
            </div>
          )
        }
      </section>

      {/* 5 ── Key exports */}
      <section className={styles.section}>
        <SectionLabel icon={IconFunction}>Key exports</SectionLabel>
        {exports_.length === 0
          ? <p className={styles.muted}>None detected.</p>
          : (
            <ul className={styles.exportList}>
              {exports_.map(e => (
                <li key={e} className={styles.exportItem}>
                  <IconFunction size={13} stroke={1.5} className={styles.exportIcon} />
                  {e}
                </li>
              ))}
            </ul>
          )
        }
      </section>

      {/* 6 ── Suggested next files */}
      {fileSummary?.suggestedNextFiles?.length > 0 && (
        <section className={styles.section}>
          <SectionLabel icon={IconArrowRight}>Read next</SectionLabel>
          <div className={styles.pillGroup}>
            {fileSummary.suggestedNextFiles.map(f => (
              <span key={f} className={`${styles.pill} ${styles.pillLocal}`}>{f}</span>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
