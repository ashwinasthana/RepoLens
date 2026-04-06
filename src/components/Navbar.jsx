import { IconSearch, IconBrandGithub, IconMenu2 } from '@tabler/icons-react'
import styles from './Navbar.module.css'

export default function Navbar({ onAnalyze, loading, onMenuClick }) {
  function handleSubmit(e) {
    e.preventDefault()
    const url = e.target.repoUrl.value.trim()
    if (url) onAnalyze(url)
  }

  return (
    <nav className={styles.nav}>
      {/* Hamburger — mobile only */}
      <button className={styles.hamburger} onClick={onMenuClick} aria-label="Toggle sidebar">
        <IconMenu2 size={20} />
      </button>

      {/* Logo */}
      <span className={styles.logo}>
        <IconSearch size={16} stroke={2.5} />
        RepoLens
      </span>

      {/* URL form */}
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

      {/* GitHub link */}
      <a
        href="https://github.com/ashwinasthana/RepoLens"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.ghLink}
        aria-label="GitHub"
      >
        <IconBrandGithub size={20} />
      </a>
    </nav>
  )
}
