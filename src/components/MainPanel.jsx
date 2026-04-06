import { useState } from 'react'
import {
  IconFolders, IconChartDots3, IconBook, IconRocket,
} from '@tabler/icons-react'
import FileDetail from './FileDetail'
import styles from './MainPanel.module.css'

const TABS = [
  { id: 'Tree',        icon: IconFolders,    label: 'Tree' },
  { id: 'Graph',       icon: IconChartDots3, label: 'Graph' },
  { id: 'Definitions', icon: IconBook,       label: 'Definitions' },
  { id: 'Onboarding',  icon: IconRocket,     label: 'Onboarding' },
]

const PLACEHOLDER_INFO = {
  Graph:       { icon: IconChartDots3, text: 'Dependency graph coming soon' },
  Definitions: { icon: IconBook,       text: 'Symbol definitions coming soon' },
  Onboarding:  { icon: IconRocket,     text: 'Onboarding guide coming soon' },
}

function EmptyState() {
  return (
    <div className={styles.empty}>
      <IconFolders size={44} stroke={1} className={styles.emptyIcon} />
      <p>Click any file or folder to explore</p>
    </div>
  )
}

function Placeholder({ tab }) {
  const info = PLACEHOLDER_INFO[tab]
  const Icon = info.icon
  return (
    <div className={styles.empty}>
      <Icon size={44} stroke={1} className={styles.emptyIcon} />
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
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} stroke={1.5} />
              {tab.label}
            </button>
          )
        })}
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
