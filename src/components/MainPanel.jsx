import { useState } from 'react'
import FileDetail from './FileDetail'
import styles from './MainPanel.module.css'

const TABS = ['Tree', 'Graph', 'Definitions', 'Onboarding']

function EmptyState() {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>🗂</span>
      <p>Click any file or folder to explore</p>
    </div>
  )
}

function Placeholder({ tab }) {
  const info = {
    Graph:       { icon: '🕸', text: 'Dependency graph coming soon' },
    Definitions: { icon: '📖', text: 'Symbol definitions coming soon' },
    Onboarding:  { icon: '🚀', text: 'Onboarding guide coming soon' },
  }[tab]
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>{info.icon}</span>
      <p>{info.text}</p>
    </div>
  )
}

export default function MainPanel({ selectedFile, fileData, aiLoading, fileSummary }) {
  const [activeTab, setActiveTab] = useState('Tree')

  return (
    <div className={styles.panel}>

      {/* Sticky tab bar */}
      <div className={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.active : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.content}>
        {activeTab === 'Tree' && (
          <div key="Tree" className={styles.tabPane}>
            {!selectedFile
              ? <EmptyState />
              : <FileDetail
                  file={selectedFile}
                  content={fileData?.content}
                  summary={fileData?.summary}
                  fileSummary={fileSummary}
                  isLoading={aiLoading}
                />
            }
          </div>
        )}
        {activeTab !== 'Tree' && (
          <div key={activeTab} className={styles.tabPane}>
            <Placeholder tab={activeTab} />
          </div>
        )}
      </div>

    </div>
  )
}
