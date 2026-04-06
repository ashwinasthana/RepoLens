import styles from './FileDetail.module.css'

export default function FileDetail({ filePath, content, summary, dependencies, commits, loading }) {
  const lines = content ? content.split('\n').length : 0
  const size = content ? (new Blob([content]).size / 1024).toFixed(1) : 0

  return (
    <div className={styles.detail}>
      <h2 className={styles.title}>{filePath}</h2>

      <div className={styles.stats}>
        <span>📏 {lines} lines</span>
        <span>💾 {size} KB</span>
      </div>

      <section className={styles.section}>
        <h3>Summary</h3>
        {loading ? (
          <p className={styles.muted}>Generating summary…</p>
        ) : (
          <p>{summary || <span className={styles.muted}>No summary available.</span>}</p>
        )}
      </section>

      <section className={styles.section}>
        <h3>Dependencies</h3>
        {loading ? (
          <p className={styles.muted}>Extracting dependencies…</p>
        ) : dependencies && dependencies.length > 0 ? (
          <ul className={styles.deps}>
            {dependencies.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        ) : (
          <p className={styles.muted}>None detected.</p>
        )}
      </section>

      <section className={styles.section}>
        <h3>Recent Commits</h3>
        {commits && commits.length > 0 ? (
          <ul className={styles.commits}>
            {commits.map(c => (
              <li key={c.sha}>
                <span className={styles.sha}>{c.sha.slice(0, 7)}</span>
                <span>{c.commit.message.split('\n')[0]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>No commit history loaded.</p>
        )}
      </section>

      {content && (
        <section className={styles.section}>
          <h3>Preview</h3>
          <pre className={styles.preview}>{content.slice(0, 2000)}{content.length > 2000 ? '\n…' : ''}</pre>
        </section>
      )}
    </div>
  )
}
