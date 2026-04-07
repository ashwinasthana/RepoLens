import { useState } from 'react'
import { IconKey, IconExternalLink, IconSparkles } from '@tabler/icons-react'
import { saveGroqApiKey } from '../services/ai'
import styles from './ApiKeyModal.module.css'

export default function ApiKeyModal({ onComplete }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!key.trim().startsWith('gsk_')) {
      setError('Invalid Groq API Key format. Should start with gsk_')
      return
    }
    saveGroqApiKey(key.trim())
    onComplete()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.iconCircle}>
            <IconKey size={24} />
          </div>
          <h2>Configure AI Access</h2>
          <p>RepoLens uses Groq (LLaMA 3.3) for high-speed local analysis. Please provide an API key to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="groq-key">Groq API Key</label>
            <input
              id="groq-key"
              type="password"
              placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError('') }}
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
          </div>

          <div className={styles.hint}>
            <IconSparkles size={14} />
            Your key is stored locally in your browser and never sent to our servers.
          </div>

          <div className={styles.actions}>
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.helperLink}
            >
              Get a free key <IconExternalLink size={14} />
            </a>
            <button type="submit" className={styles.submitBtn} disabled={!key.trim()}>
              Save & Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
