import { useState } from 'react'
import FileDetail from './FileDetail'
import styles from './MainPanel.module.css'

export default function MainPanel({ repoInfo, repoSummary, selectedFile, fileData, aiLoading }) {
  const [tab, setTab] = useState('overview')

  return (
    <div className={styles.panel}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'overview' ? styles.active : ''}`}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${tab === 'file' ? styles.active : ''}`}
          onClick={() => setTab('file')}
          disabled={!selectedFile}
        >
          File Details
        </button>
      </div>

      <div className={styles.content}>
        {tab === 'overview' ? (
          <div className={styles.overview}>
            {!repoInfo ? (
              <div className={styles.empty}>
                <p>🔍 Enter a GitHub repository URL above to get started.</p>
              </div>
            ) : (
              <>
                <h2>{repoInfo.full_name}</h2>
                <p className={styles.desc}>{repoInfo.description}</p>
                <div className={styles.meta}>
                  <span>⭐ {repoInfo.stargazers_count?.toLocaleString()}</span>
                  <span>🍴 {repoInfo.forks_count?.toLocaleString()}</span>
                  <span>🔤 {repoInfo.language}</span>
                  <span>👁 {repoInfo.watchers_count?.toLocaleString()}</span>
                </div>
                <section className={styles.summaryBox}>
                  <h3>AI Summary</h3>
                  {aiLoading ? (
                    <p className={styles.muted}>Generating summary…</p>
                  ) : (
                    <p>{repoSummary || <span className={styles.muted}>No summary yet.</span>}</p>
                  )}
                </section>
              </>
            )}
          </div>
        ) : (
          selectedFile && fileData ? (
            <FileDetail
              filePath={selectedFile}
              content={fileData.content}
              summary={fileData.summary}
              dependencies={fileData.dependencies}
              commits={fileData.commits}
              loading={aiLoading}
            />
          ) : (
            <div className={styles.empty}><p>Select a file from the sidebar.</p></div>
          )
        )}
      </div>
    </div>
  )
}
