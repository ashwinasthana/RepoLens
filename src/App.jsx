import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import MainPanel from './components/MainPanel'
import StatusBar from './components/StatusBar'
import ChatWidget from './components/ChatWidget'
import { parseGithubUrl, fetchRepoInfo, fetchFileTree, fetchFileContent } from './services/github'
import { analyzeFile, analyzeGraph, analyzeDefinitions, analyzeOnboarding } from './services/ai'
import styles from './App.module.css'

export default function App() {
  const [repoUrl,      setRepoUrl]      = useState('')
  const [repoInfo,     setRepoInfo]     = useState(null)
  const [isLoading,    setIsLoading]    = useState(false)
  const [fileTree,     setFileTree]     = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent,  setFileContent]  = useState('')
  const [error,        setError]        = useState('')
  const [repoContext,  setRepoContext]  = useState('')

  // Per-file analysis results (cached by path)
  const [analysisCache, setAnalysisCache] = useState({})

  // UI-only state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerOpen,       setDrawerOpen]       = useState(false)

  // Toast notifications for non-blocking errors
  const [toasts, setToasts] = useState([])

  function addToast(message, type = 'error') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  // Helper to get/set cache for a file
  function getCached(path) {
    return analysisCache[path] || {}
  }

  function setCached(path, key, value) {
    setAnalysisCache(prev => ({
      ...prev,
      [path]: { ...prev[path], [key]: value }
    }))
  }

  // ── Extension handoff ─────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initRepo = params.get('repoUrl')

    if (initRepo) {
      window.history.replaceState({}, '', window.location.pathname)
      handleAnalyze(initRepo)
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
    setAnalysisCache({})

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
    setError('')
    setDrawerOpen(false)

    try {
      const { owner, repo } = parseGithubUrl(repoUrl)
      const content = await fetchFileContent(owner, repo, node.path)
      setFileContent(content)

      // Fire all analyses in parallel (only if not cached)
      const cached = getCached(node.path)

      if (!cached.summary) {
        analyzeFile(node.name, content, repoContext)
          .then(result => setCached(node.path, 'summary', result))
          .catch(e => {
            console.error('Summary error:', e)
            addToast(`Summary analysis failed: ${e.message}`)
            setCached(node.path, 'summary', { summary: '', purpose: '', error: e.message })
          })
      }

      if (!cached.graph) {
        analyzeGraph(node.name, content, repoContext)
          .then(result => setCached(node.path, 'graph', result))
          .catch(e => {
            console.error('Graph error:', e)
            addToast(`Graph analysis failed: ${e.message}`)
            setCached(node.path, 'graph', { imports: [], error: e.message })
          })
      }

      if (!cached.definitions) {
        analyzeDefinitions(node.name, content, repoContext)
          .then(result => setCached(node.path, 'definitions', result))
          .catch(e => {
            console.error('Definitions error:', e)
            addToast(`Definitions analysis failed: ${e.message}`)
            setCached(node.path, 'definitions', { definitions: [], error: e.message })
          })
      }

      if (!cached.onboarding) {
        analyzeOnboarding(node.name, content, repoContext)
          .then(result => setCached(node.path, 'onboarding', result))
          .catch(e => {
            console.error('Onboarding error:', e)
            addToast(`Onboarding analysis failed: ${e.message}`)
            setCached(node.path, 'onboarding', { whatItSolves: '', error: e.message })
          })
      }
    } catch (e) {
      setError(e.message)
    }
  }

  // ── 3. Retry analysis for a file ──────────────────────────────────────────
  function handleRetryAnalysis() {
    if (!selectedFile || !fileContent) return
    // Clear the cache for this file and rerun
    setAnalysisCache(prev => {
      const next = { ...prev }
      delete next[selectedFile.path]
      return next
    })
    // Re-trigger analysis
    const node = selectedFile
    const content = fileContent
    const cached = {} // Force all fresh

    analyzeFile(node.name, content, repoContext)
      .then(result => setCached(node.path, 'summary', result))
      .catch(e => addToast(`Summary retry failed: ${e.message}`))

    analyzeGraph(node.name, content, repoContext)
      .then(result => setCached(node.path, 'graph', result))
      .catch(e => addToast(`Graph retry failed: ${e.message}`))

    analyzeDefinitions(node.name, content, repoContext)
      .then(result => setCached(node.path, 'definitions', result))
      .catch(e => addToast(`Definitions retry failed: ${e.message}`))

    analyzeOnboarding(node.name, content, repoContext)
      .then(result => setCached(node.path, 'onboarding', result))
      .catch(e => addToast(`Onboarding retry failed: ${e.message}`))
  }

  const currentAnalysis = selectedFile ? getCached(selectedFile.path) : {}

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

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className={styles.toastContainer}>
          {toasts.map(toast => (
            <div key={toast.id} className={`${styles.toast} ${styles[toast.type] || ''}`}>
              {toast.message}
            </div>
          ))}
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
          fileContent={fileContent}
          analysis={currentAnalysis}
          hasRepo={!!repoInfo}
          onRetryAnalysis={handleRetryAnalysis}
        />
      </div>

      <StatusBar repoInfo={repoInfo} fileTree={fileTree} />

      {repoInfo && (
        <ChatWidget
          repoContext={repoContext}
          selectedFileName={selectedFile?.path}
          selectedFileContent={fileContent}
        />
      )}
    </div>
  )
}
