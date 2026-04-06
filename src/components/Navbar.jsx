import styles from './Navbar.module.css'

export default function Navbar({ onAnalyze, loading }) {
  function handleSubmit(e) {
    e.preventDefault()
    const url = e.target.repoUrl.value.trim()
    if (url) onAnalyze(url)
  }

  return (
    <nav className={styles.nav}>
      <span className={styles.logo}>
        🔍 <strong>RepoLens</strong>
      </span>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          name="repoUrl"
          placeholder="https://github.com/owner/repo"
          className={styles.input}
          required
        />
        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </form>
    </nav>
  )
}
