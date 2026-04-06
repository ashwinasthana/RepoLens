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
        <span className={styles.dot} />
        {repoInfo.full_name}
      </span>
      <span className={styles.sep}>·</span>
      <span className={styles.item}>{fileCount} files</span>
      <span className={styles.sep}>·</span>
      <span className={styles.item}>{repoInfo.language ?? 'Unknown'}</span>
      <span className={styles.sep}>·</span>
      <span className={styles.item}>analyzed just now</span>
    </div>
  )
}
