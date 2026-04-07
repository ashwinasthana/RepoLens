import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import MainPanel from './components/MainPanel'
import StatusBar from './components/StatusBar'
import ChatWidget from './components/ChatWidget'
import { parseGithubUrl, fetchRepoInfo, fetchFileTree, fetchFileContent } from './services/github'
import { analyzeFile, analyzeGraph, analyzeDefinitions, analyzeOnboarding, getGroqApiKey } from './services/ai'
import ApiKeyModal from './components/ApiKeyModal'
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
  const [hasApiKey,    setHasApiKey]    = useState(!!getGroqApiKey())

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

  async function runAnalysisStep(node, content, key, fn, label) {
    try {
      const result = await fn(node.name, content, repoContext)
      setCached(node.path, key, result)
    } catch (e) {
      console.error(`${label} error:`, e)
      addToast(`${label} analysis failed: ${e.message}`)
      if (key === 'summary') setCached(node.path, 'summary', { summary: '', purpose: '', error: e.message })
      if (key === 'graph') setCached(node.path, 'graph', { imports: [], error: e.message })
      if (key === 'definitions') setCached(node.path, 'definitions', { definitions: [], error: e.message })
      if (key === 'onboarding') setCached(node.path, 'onboarding', { whatItSolves: '', error: e.message })
    }
  }

  function runAllAnalysesSequential(node, content, cached = {}) {
    if (!cached.summary) {
      setCached(node.path, 'summary', { loading: true })
    }
    if (!cached.graph) {
      setCached(node.path, 'graph', { loading: true })
    }
    if (!cached.definitions) {
      setCached(node.path, 'definitions', { loading: true })
    }
    if (!cached.onboarding) {
      setCached(node.path, 'onboarding', { loading: true })
    }

    // Fire-and-forget sequential pipeline to avoid TPM bursts.
    ;(async () => {
      if (!cached.summary) {
        await runAnalysisStep(node, content, 'summary', analyzeFile, 'Summary')
      }
      if (!cached.graph) {
        await runAnalysisStep(node, content, 'graph', analyzeGraph, 'Graph')
      }
      if (!cached.definitions) {
        await runAnalysisStep(node, content, 'definitions', analyzeDefinitions, 'Definitions')
      }
      if (!cached.onboarding) {
        await runAnalysisStep(node, content, 'onboarding', analyzeOnboarding, 'Onboarding')
      }
    })()
  }

  // ── Extension handoff ─────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initRepo = params.get('repoUrl')
    const initFile = params.get('file')
    const authKey  = params.get('auth')

    if (authKey) {
      import('./services/ai').then(({ saveGroqApiKey }) => {
        saveGroqApiKey(authKey)
        setHasApiKey(true)
      })
    }

    if (initRepo) {
      window.history.replaceState({}, '', window.location.pathname)
      handleAnalyze(initRepo, initFile)
    }
  }, [])

  // ── 1. Analyze repo ───────────────────────────────────────────────────────
  async function handleAnalyze(url, initialFile = null) {
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

      // Auto-select file if provided
      if (initialFile) {
        // Flatten the tree to find the node
        const findNode = (nodes, path) => {
          for (const n of nodes) {
            if (n.path === path) return n
            if (n.children) {
              const res = findNode(n.children, path)
              if (res) return res
            }
          }
          return null
        }
        const node = findNode(tree.children, initialFile)
        if (node) handleFileClick(node, url)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  // ── 2. File clicked in sidebar ────────────────────────────────────────────
  async function handleFileClick(node, currentRepoUrl = repoUrl) {
    if (node.type === 'tree') return
    setSelectedFile(node)
    setFileContent('')
    setError('')
    setDrawerOpen(false)

    try {
      const { owner, repo } = parseGithubUrl(currentRepoUrl)
      const content = await fetchFileContent(owner, repo, node.path)
      setFileContent(content)

      // Run analyses sequentially (only if not cached) to reduce rate-limit spikes.
      const cached = getCached(node.path)
      runAllAnalysesSequential(node, content, cached)
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
    // Re-trigger analysis sequentially
    const node = selectedFile
    const content = fileContent
    runAllAnalysesSequential(node, content, {})
  }

  const currentAnalysis = selectedFile ? getCached(selectedFile.path) : {}

  return (
    <div className={styles.app}>
      {!hasApiKey && <ApiKeyModal onComplete={() => setHasApiKey(true)} />}
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
