import { useState, useEffect } from 'react'
import {
  IconSearch, IconBrandGithub, IconSparkles, IconChartDots3,
  IconBook, IconRocket, IconCode, IconRoute, IconBolt,
  IconArrowUp, IconBrain, IconTerminal2, IconShieldCheck,
} from '@tabler/icons-react'
import styles from './WelcomeScreen.module.css'
import dashboardImg from '../assets/dashboard-preview.png'

const FEATURES = [
  { icon: IconSparkles, title: 'AI Synthesis', desc: '4-way parallel AI analysis per file via RepoLens-7B v1', color: '#58a6ff' },
  { icon: IconChartDots3, title: 'Visual Graphs', desc: 'Automated dependency mapping and role analysis', color: '#bc8cff' },
  { icon: IconBook, title: 'Intelligent Symbol Parsing', desc: 'Symbol definitions with behavioral context', color: '#f778ba' },
  { icon: IconRocket, title: 'Onboarding Engine', desc: 'Instant guides for new codebase contributors', color: '#ffa657' },
]

const TECH_STACK = [
  { icon: IconBrain, label: 'Private Cluster' },
  { icon: IconBolt, label: 'Fine-tuned LLM' },
  { icon: IconTerminal2, label: 'React + Vite' },
  { icon: IconShieldCheck, label: 'GitHub API' },
]

export default function WelcomeScreen() {
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 150)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={styles.welcome}>
      <div className={styles.gridBg} />
      <div className={styles.radialOverlay} />
      <div className={styles.ambientGlow} />

      <div className={`${styles.container} ${showContent ? styles.visible : ''}`}>
        <div className={styles.contentCol}>
          <div className={styles.badgeRow}>
            <div className={styles.pillBadge}>
              <IconSparkles size={14} /> <span>Custom Fine-tuned Model</span>
            </div>
          </div>

          <h1 className={styles.title}>
            Navigate Code at the <span className={styles.accent}>Speed of Thought.</span>
          </h1>

          <p className={styles.subtitle}>
            RepoLens transforms complex GitHub repositories into searchable, summarized, and visualized intelligence.
          </p>

          <div className={styles.inputHint}>
            <div className={styles.hintArrow}><IconArrowUp size={16} /></div>
            <span>Paste any repository URL above to begin.</span>
          </div>

          <div className={styles.featureGrid}>
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className={styles.featureCard} style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
                  <div className={styles.featureIcon} style={{ background: `${f.color}15`, color: f.color }}>
                    <Icon size={20} stroke={2} />
                  </div>
                  <div className={styles.featureText}>
                    <h4>{f.title}</h4>
                    <p>{f.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className={styles.footerRow}>
            <div className={styles.techStack}>
              {TECH_STACK.map((t, i) => (
                <div key={i} className={styles.techItem}>
                  <t.icon size={13} /> <span>{t.label}</span>
                </div>
              ))}
            </div>
            <a href="https://github.com/ashwinasthana/RepoLens" target="_blank" rel="noreferrer" className={styles.ghStar}>
              <IconBrandGithub size={16} /> Star Project
            </a>
          </div>
        </div>

        <div className={styles.previewCol}>
          <div className={styles.previewContainer}>
            <div className={styles.previewGlow} />
            <img src={dashboardImg} alt="RepoLens Preview" className={styles.previewImg} />
            <div className={styles.browserBar}>
              <div className={styles.dots}><span /><span /><span /></div>
              <div className={styles.address}>ashwinasthana.github.io/RepoLens/</div>
            </div>
            {/* Floating UI Elements */}
            <div className={`${styles.floatCard} ${styles.float1}`}>
              <IconRoute size={16} /> <span>Extension sidebar active</span>
            </div>
            <div className={`${styles.floatCard} ${styles.float2}`}>
              <IconSparkles size={16} /> <span>Summary generated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

