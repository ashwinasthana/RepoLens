import { IconCircleFilled, IconCode, IconFiles, IconClock } from '@tabler/icons-react'
import styles from './StatusBar.module.css'

export default function StatusBar({ repoInfo, fileTree }) {
  if (!repoInfo) return <div className={styles.bar} />

  const fileCount = fileTree
    ? fileTree.children?.reduce(function count(acc, n) {
        return n.type === 'blob' ? acc + 1 : acc + (n.children ?? []).reduce(count, 0)
      }, 0)
    : '—'

  return (
    <div className={styles.bar}>
      <span className={styles.item}>
        <IconCircleFilled size={8} className={styles.dot} />
        {repoInfo.full_name}
      </span>
      <span className={styles.sep}>·</span>
      <span className={styles.item}>
        <IconFiles size={12} stroke={1.5} />
        {fileCount} files
      </span>
      <span className={styles.sep}>·</span>
      <span className={styles.item}>
        <IconCode size={12} stroke={1.5} />
        {repoInfo.language ?? 'Unknown'}
      </span>
      <span className={styles.sep}>·</span>
      <span className={styles.item}>
        <IconClock size={12} stroke={1.5} />
        analyzed just now
      </span>
    </div>
  )
}
