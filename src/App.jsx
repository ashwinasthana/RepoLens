import { useState } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import MainPanel from './components/MainPanel'
import { parseGithubUrl, fetchFileTree, fetchFileContent } from './services/github'
import { summarizeFile, extractDependencies, summarizeRepo } from './services/ai'
import styles from './App.module.css'

const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || ''
const AI_KEY = import.meta.env.VITE_OPENAI_KEY || ''

export default function App() {
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [repoInfo, setRepoInfo] = useState(null)
  const [repoSummary, setRepoSummary] = useState('')
  const [tree, setTree] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileCache, setFileCache] = useState({})
  const [error, setError] = useState('')

  async function handleAnalyze(url) {
    setLoading(true)
    setError('')
    setRepoInfo(null)
    setTree(null)
    setSelectedFile(null)
    setFileCache({})
    setRepoSummary('')
    try {
      const { owner, repo } = parseGithubUrl(url)
      const [infoRes, treeRoot] = await Promise.all([
        fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { Accept: 'application/vnd.github+json', ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}) }
        }).then(r => r.json()),
        fetchFileTree(owner, repo),
      ])
      setRepoInfo(infoRes)
      setTree(treeRoot)
      setRepoUrl(url)

      if (AI_KEY) {
        setAiLoading(true)
        summarizeRepo(infoRes, [], AI_KEY)
          .then(s => setRepoSummary(s))
          .finally(() => setAiLoading(false))
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectFile(filePath) {
    setSelectedFile(filePath)
    if (fileCache[filePath]) return

    try {
      const { owner, repo } = parseGithubUrl(repoUrl)
      const content = await fetchFileContent(owner, repo, filePath)
      const commits = []
      const entry = { content, commits, summary: '', dependencies: [] }
      setFileCache(c => ({ ...c, [filePath]: entry }))

      if (AI_KEY) {
        setAiLoading(true)
        const [summary, depsRaw] = await Promise.all([
          summarizeFile(filePath, content, AI_KEY),
          extractDependencies(filePath, content, AI_KEY),
        ])
        let deps = []
        try { deps = JSON.parse(depsRaw) } catch { deps = [] }
        setFileCache(c => ({ ...c, [filePath]: { ...c[filePath], summary, dependencies: deps } }))
        setAiLoading(false)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className={styles.app}>
      <Navbar onAnalyze={handleAnalyze} loading={loading} />
      {error && <div className={styles.error}>⚠ {error}</div>}
      <div className={styles.body}>
        <Sidebar
          tree={tree}
          onSelectFile={path => { handleSelectFile(path) }}
          selectedFile={selectedFile}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
        />
        <MainPanel
          repoInfo={repoInfo}
          repoSummary={repoSummary}
          selectedFile={selectedFile}
          fileData={fileCache[selectedFile]}
          aiLoading={aiLoading}
        />
      </div>
    </div>
  )
}
