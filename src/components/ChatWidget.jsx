import { useState, useRef, useEffect } from 'react'
import { IconSparkles, IconX, IconSend, IconUser, IconRobot } from '@tabler/icons-react'
import styles from './ChatWidget.module.css'
import { askRepoQuestion } from '../services/ai'

export default function ChatWidget({ repoContext, selectedFileContent, selectedFileName }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'What would you like to know about this repository?' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const context = `Repo: ${repoContext}\nFile selected: ${selectedFileName || 'None'}\nContent snippet:\n${selectedFileContent?.slice(0, 1500) || 'N/A'}`
      const answer = await askRepoQuestion(userMessage, context)
      setMessages(prev => [...prev, { role: 'assistant', content: answer }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button className={styles.fab} onClick={() => setIsOpen(true)}>
        <IconSparkles size={20} />
        <span>Ask AI</span>
      </button>
    )
  }

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <div className={styles.title}><IconSparkles size={16} /> RepoLens Chat</div>
        <button className={styles.closeBtn} onClick={() => setIsOpen(false)}><IconX size={16} /></button>
      </div>

      <div className={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.message} ${styles[m.role]}`}>
            <div className={styles.avatar}>
              {m.role === 'user' ? <IconUser size={14} /> : <IconRobot size={14} />}
            </div>
            <div className={styles.content}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.avatar}><IconRobot size={14} /></div>
            <div className={styles.content}><span className={styles.typing}>...</span></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form className={styles.inputArea} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ask a question..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={!input.trim() || loading}>
          <IconSend size={16} />
        </button>
      </form>
    </div>
  )
}
