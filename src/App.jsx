import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import MainPanel from './components/MainPanel'
import StatusBar from './components/StatusBar'
import { parseGithubUrl, fetchRepoInfo, fetchFileTree, fetchFileContent } from './services/github'
import { analyzeFile } from './services/ai'
import styles from './App.module.css'

export default function App() {
  const [repoUrl,      setRepoUrl]      = useState('')
  const [repoInfo,     setRepoInfo]     = useState(null)
  const [isLoading,    setIsLoading]    = useState(false)
  const [fileTree,     setFileTree]     = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent,  setFileContent]  = useState('')
  const [fileSummary,  setFileSummary]  = useState(null)
  const [error,        setError]        = useState('')
  const [repoContext,  setRepoContext]  = useState('')

  // UI-only state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerOpen,       setDrawerOpen]       = useState(false)

  // ── Extension handoff ─────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('from') !== 'extension') return

    const raw = localStorage.getItem('repolens_handoff')
    if (!raw) return

    try {
      const handoff = JSON.parse(raw)
      localStorage.removeItem('repolens_handoff')

      // Clean the URL
      window.history.replaceState({}, '', window.location.pathname)

      if (handoff.repoUrl) {
        handleAnalyze(handoff.repoUrl).then(() => {
          // If a file was selected in the extension, auto-select it
          if (handoff.file && handoff.content) {
            const node = { path: handoff.file, name: handoff.file.split('/').pop(), type: 'blob' }
            setSelectedFile(node)
            setFileContent(handoff.content)

            // Use cached analysis if available
            if (handoff.analysis?.summary) {
              setFileSummary(handoff.analysis.summary)
            }
          }
        })
      }
    } catch (e) {
      console.warn('[RepoLens] Failed to parse extension handoff:', e)
    }
  }, [])

  // ── 1. Analyze repo ───────────────────────────────────────────────────────
  async function handleAnalyze(url) {
    setIsLoading(true)
    setError('')
    setRepoInfo(null)
    setFileTree(null)
    setSelectedFile(null)
    setFileContent('')
    setFileSummary(null)

    try {
      const { owner, repo } = parseGithubUrl(url)
      const [info, tree] = await Promise.all([
        fetchRepoInfo(owner, repo),
        fetchFileTree(owner, repo),
      ])
      setRepoUrl(url)
      setRepoInfo(info)
      setFileTree(tree)
      setRepoContext(`${info.full_name} — ${info.description ?? ''} (${info.language ?? 'unknown'})`)
    } catch (e) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  // ── 2. File clicked in sidebar ────────────────────────────────────────────
  async function handleFileClick(node) {
    if (node.type === 'tree') return
    setSelectedFile(node)
    setFileContent('')
    setFileSummary(null)
    setError('')
    setDrawerOpen(false)   // close drawer on mobile after selecting a file

    try {
      const { owner, repo } = parseGithubUrl(repoUrl)
      const content = await fetchFileContent(owner, repo, node.path)
      setFileContent(content)

      analyzeFile(node.name, content, repoContext)
        .then(result => setFileSummary(result))
        .catch(e => setError(`AI error: ${e.message}`))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className={styles.app}>
      <Navbar
        onAnalyze={handleAnalyze}
        loading={isLoading}
        onMenuClick={() => setDrawerOpen(o => !o)}
      />

      {error && (
        <div className={styles.errorBanner}>
          <span>⚠</span> {error}
          <button className={styles.errorDismiss} onClick={() => setError('')}>✕</button>
        </div>
      )}

      <div className={styles.body}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <span className={styles.spinner} />
            <p className={styles.loadingText}>Scanning repository…</p>
          </div>
        )}

        <Sidebar
          tree={fileTree}
          onFileClick={handleFileClick}
          selectedFile={selectedFile?.path}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
          drawerOpen={drawerOpen}
          onDrawerClose={() => setDrawerOpen(false)}
        />

        <MainPanel
          selectedFile={selectedFile?.path ?? null}
          fileData={selectedFile ? { content: fileContent, summary: fileSummary?.summary ?? '' } : null}
          aiLoading={!!selectedFile && !fileSummary}
          fileSummary={fileSummary}
        />
      </div>

      <StatusBar repoInfo={repoInfo} fileTree={fileTree} />
    </div>
  )
}
