import { useState } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import MainPanel from './components/MainPanel'
import { parseGithubUrl, fetchRepoInfo, fetchFileTree, fetchFileContent } from './services/github'
import { analyzeFile } from './services/ai'
import styles from './App.module.css'

export default function App() {
  const [repoUrl,     setRepoUrl]     = useState('')
  const [isLoading,   setIsLoading]   = useState(false)
  const [fileTree,    setFileTree]    = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)   // full node object
  const [fileContent, setFileContent] = useState('')
  const [fileSummary, setFileSummary] = useState(null)     // analyzeFile() result
  const [error,       setError]       = useState('')

  // Sidebar collapse is purely UI — keep it local
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // ── repoContext string passed to analyzeFile ──
  const [repoContext, setRepoContext] = useState('')

  // ── 1. Analyze repo ───────────────────────────────────────────────────────
  async function handleAnalyze(url) {
    setIsLoading(true)
    setError('')
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
    if (node.type === 'tree') return          // folder click — nothing to load
    setSelectedFile(node)
    setFileContent('')
    setFileSummary(null)
    setError('')

    try {
      const { owner, repo } = parseGithubUrl(repoUrl)
      const content = await fetchFileContent(owner, repo, node.path)
      setFileContent(content)

      // AI analysis — non-blocking; update summary when ready
      analyzeFile(node.name, content, repoContext)
        .then(result => setFileSummary(result))
        .catch(e => setError(`AI error: ${e.message}`))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className={styles.app}>
      <Navbar onAnalyze={handleAnalyze} loading={isLoading} />

      {error && (
        <div className={styles.errorBanner}>
          <span>⚠</span> {error}
          <button className={styles.errorDismiss} onClick={() => setError('')}>✕</button>
        </div>
      )}

      <div className={styles.body}>
        {/* Loading overlay — shown while fetching the tree */}
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
        />

        <MainPanel
          selectedFile={selectedFile?.path ?? null}
          fileData={selectedFile ? { content: fileContent, summary: fileSummary?.summary ?? '', dependencies: fileSummary?.keyExports ?? [] } : null}
          aiLoading={!!selectedFile && !fileSummary}
          fileSummary={fileSummary}
        />
      </div>
    </div>
  )
}
