import { useState, useEffect } from 'react'
import {
  IconSearch, IconBrandGithub, IconSparkles, IconChartDots3,
  IconBook, IconRocket, IconCode, IconFileCode, IconBrain,
  IconArrowUp, IconPackage, IconRoute, IconBolt,
  IconTerminal2, IconShieldCheck,
} from '@tabler/icons-react'
import styles from './WelcomeScreen.module.css'
import heroDashboard from '../../assets/hero-dashboard.png'
import integrationsPreview from '../../assets/integrations-preview.png'

const FEATURES = [
  { icon: IconSparkles,     title: 'AI Summary',        desc: '4 parallel AI analyses per file — summary, graph, definitions, onboarding', color: '#58a6ff' },
  { icon: IconChartDots3,   title: 'Dependency Graph',  desc: 'Visual import/export mapping with architecture role analysis', color: '#bc8cff' },
  { icon: IconBook,         title: 'Smart Definitions', desc: 'Every function, class & export documented with params and patterns', color: '#f778ba' },
  { icon: IconRocket,       title: 'Dev Onboarding',    desc: 'Per-file guides: prerequisites, key concepts, pitfalls, reading order', color: '#ffa657' },
  { icon: IconCode,         title: 'Code Viewer',       desc: 'Syntax-highlighted code display with line numbers and one-click copy', color: '#7ee787' },
  { icon: IconRoute,        title: 'Chrome Extension',  desc: 'Sidebar that embeds directly into GitHub — zero context switching', color: '#79c0ff' },
]

const FLOATING_SYMBOLS = ['{', '}', '/>', '</', '=>', '()', '[]', ';;', '&&', '||', '!=', '**', '++', '::', 'fn', '  ', '0x']

const TECH_STACK = [
  { icon: IconBrain,         label: 'LLaMA 3.3 70B' },
  { icon: IconBolt,          label: 'Groq Inference' },
  { icon: IconTerminal2,     label: 'React + Vite' },
  { icon: IconShieldCheck,   label: 'GitHub API' },
]

export default function WelcomeScreen() {
  const [typedText, setTypedText] = useState('')
  const [showContent, setShowContent] = useState(false)
  const fullText = 'Understand any GitHub repository in seconds.'

  useEffect(() => {
    // Stagger the content appearance
    const contentTimer = setTimeout(() => setShowContent(true), 200)

    let i = 0
    const timer = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i))
        i++
      } else {
        clearInterval(timer)
      }
    }, 30)
    return () => { clearInterval(timer); clearTimeout(contentTimer) }
  }, [])

  return (
    <div className={styles.welcome}>
      {/* Animated background grid */}
      <div className={styles.gridBg} />

      {/* Radial gradient overlay */}
      <div className={styles.radialOverlay} />

      {/* Floating code symbols */}
      <div className={styles.particles}>
        {FLOATING_SYMBOLS.map((sym, i) => (
          <span
            key={i}
            className={styles.particle}
            style={{
              left: `${5 + (i * 7) % 90}%`,
              animationDelay: `${i * 0.6}s`,
              animationDuration: `${14 + (i % 5) * 3}s`,
              fontSize: `${12 + (i % 4) * 4}px`,
            }}
          >
            {sym}
          </span>
        ))}
      </div>

      {/* Hero content */}
      <div className={`${styles.hero} ${showContent ? styles.heroVisible : ''}`}>
        {/* Glowing orb behind icon */}
        <div className={styles.glowOrb} />
        <div className={styles.glowOrb2} />

        <div className={styles.logoRow}>
          <div className={styles.logoBadge}>
            <IconSearch size={32} stroke={2.5} className={styles.logoIcon} />
          </div>
        </div>

        <h1 className={styles.title}>
          <span className={styles.gradientText}>The best way to understand</span>
          <br />
          Any GitHub Repository.
        </h1>

        <p className={styles.subtitle}>
          AI-powered repository intelligence that maps architecture, logic, and complexity in seconds.
        </p>

        <div className={styles.ctaWrapper}>
          <div className={styles.cta}>
            <IconArrowUp size={16} stroke={2.5} className={styles.ctaArrow} />
            <span>Paste a GitHub URL to analyze</span>
          </div>
        </div>

        {/* Hero Dashboard Preview */}
        <div className={styles.heroMockup}>
          <div className={styles.mockupTitle}><IconSearch size={18} /> Deep-Dive Analysis</div>
          <img src={heroDashboard} alt="RepoLens Dashboard Preview" className={styles.mockupImg} />
          <div className={styles.mockupGlow} />
        </div>

        {/* Feature grid */}
        <div className={styles.sectionHeading}>
          <div className={styles.accentBar} />
          <h2 className={styles.sectionTitle}>Everything you need to ship faster</h2>
        </div>

        <div className={styles.features}>
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <div key={i} className={styles.featureCard} style={{ animationDelay: `${0.4 + i * 0.08}s` }}>
                <div className={styles.featureIcon} style={{ background: `${f.color}15`, color: f.color }}>
                  <Icon size={20} stroke={1.5} />
                </div>
                <div>
                  <h3 className={styles.featureTitle}>{f.title}</h3>
                  <p className={styles.featureDesc}>{f.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Integrations Section */}
        <div className={styles.integrationsPanel}>
          <div className={styles.integrationsInfo}>
            <div className={styles.accentBar} />
            <h2 className={styles.sectionTitle}>Seamless AI Integration</h2>
            <p className={styles.integrationsDesc}>
              Leverage LLaMA 3.3 and Groq's high-speed inference to process codebases without the wait.
              Directly integrates with the GitHub API for real-time repo fetching.
            </p>
          </div>
          <div className={styles.integrationsMockup}>
            <img src={integrationsPreview} alt="AI Integrations Visual" className={styles.integrationsImg} />
            <div className={styles.mockupGlow} />
          </div>
        </div>

        {/* Tech Stack bar */}
        <div className={styles.techBar}>
          {TECH_STACK.map((t, i) => {
            const Icon = t.icon
            return (
              <div key={i} className={styles.techItem}>
                <Icon size={14} stroke={1.5} />
                <span>{t.label}</span>
              </div>
            )
          })}
        </div>

        {/* GitHub link */}
        <a
          href="https://github.com/ashwinasthana/RepoLens"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.ghLink}
        >
          <IconBrandGithub size={15} stroke={1.5} />
          <span>Star on GitHub</span>
          <IconArrowUp size={12} stroke={2} style={{ transform: 'rotate(45deg)' }} />
        </a>
      </div>
    </div>
  )
}
