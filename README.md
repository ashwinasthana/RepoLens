<p align="center">
  <img src="assets/banner.png" alt="RepoLens Banner" width="100%" />
</p>

<h1 align="center">🔍 RepoLens</h1>

<p align="center">
  <strong>Understand any GitHub repository in seconds.</strong><br/>
  Paste a repo URL, browse its file tree, and get instant AI-powered explanations of what every file does — right in your browser.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Groq-LLaMA_3.3-F55036?style=for-the-badge&logo=meta&logoColor=white" alt="Groq" />
  <img src="https://img.shields.io/badge/Chrome-Extension_MV3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-chrome-extension-setup">Extension</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🌲 **Interactive File Tree** | Browse any public GitHub repo with a collapsible, syntax-aware sidebar |
| 🤖 **AI File Analysis** | Instant structured breakdowns — purpose, summary, complexity, key exports, and suggested next reads |
| 📊 **File Stats at a Glance** | Line count, file size, language detection, and entry-point identification |
| 🔗 **Dependency Mapping** | Auto-detects `import`/`require` statements and categorizes them as local vs. npm |
| 📐 **Dependency Graph** | Visual graph showing what a file imports and what imports it, with architecture role analysis |
| 📖 **Definitions Explorer** | AI-powered listing of every function, class, constant, and type with parameter/return info |
| 🚀 **Onboarding Guide** | Per-file developer onboarding: prerequisites, key concepts, how-to-modify guides, and pitfall warnings |
| 🧩 **Chrome Extension** | Injects a RepoLens sidebar directly into GitHub pages — zero context switching |
| 📱 **Responsive Design** | Mobile-friendly with a slide-out drawer for the file tree |
| 🌙 **Dark Theme** | GitHub-inspired dark UI that's easy on the eyes |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- A **GitHub Personal Access Token** ([create one here](https://github.com/settings/tokens)) — for higher API rate limits
- A **Groq API Key** ([get one here](https://console.groq.com/keys)) — for AI-powered analysis

### Installation

```bash
# Clone the repository
git clone https://github.com/ashwinasthana/RepoLens.git
cd RepoLens

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

Edit `.env` with your keys:

```env
VITE_GITHUB_TOKEN=ghp_your_token_here
VITE_GROQ_API_KEY=gsk_your_key_here
```

### Run the Web App

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and paste any GitHub repo URL to get started.

### Build for Production

```bash
npm run build
npm run preview
```

---

## 🧩 Chrome Extension Setup

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** and select the `extension/` folder
4. Navigate to any GitHub repository — you'll see a **🔍 RepoLens** button injected into the page
5. Click it to open the AI-powered sidebar

> **Note:** The extension requires a Groq API key stored in Chrome's extension storage. You'll be prompted to enter it on first use. You can also set it manually:
> ```js
> // In the extension's service worker console
> chrome.storage.sync.set({ groqApiKey: 'gsk_your_key_here' })
> ```

---

## 🤖 How the AI Works

RepoLens uses **Groq's** inference API running **LLaMA 3.3 70B Versatile** to analyze files. When you click on a file, **four parallel AI analyses** fire simultaneously:

| Tab | What it does | Max tokens |
|-----|-------------|-----------|
| **Summary** | Purpose, summary, complexity, key exports, suggested next files | 1,024 |
| **Graph** | Import/export relationships, architecture role, data flow | 1,024 |
| **Definitions** | Every function/class/const with params, returns, and design patterns | 2,048 |
| **Onboarding** | Problem solved, prerequisites, key concepts, modification guide, pitfalls | 2,048 |

All results are **cached per file path** — switching between already-analyzed files is instant.

---

## 🏗️ Architecture

```
RepoLens/
├── src/
│   ├── main.jsx                 # App entry point
│   ├── App.jsx                  # Central state hub & orchestrator
│   ├── index.css                # Global styles & design tokens
│   ├── App.module.css           # App layout styles
│   ├── components/
│   │   ├── Navbar.jsx           # URL input bar + mobile menu toggle
│   │   ├── Sidebar.jsx          # Recursive file tree with language icons
│   │   ├── MainPanel.jsx        # Tab container (Summary/Graph/Defs/Onboarding)
│   │   └── StatusBar.jsx        # Repo metadata footer
│   └── services/
│       ├── github.js            # GitHub API client (tree, content, metadata)
│       └── ai.js                # Groq LLaMA 3.3 integration (4 analysis types)
├── extension/                   # Chrome MV3 Extension
│   ├── manifest.json            # Extension config & permissions
│   ├── background.js            # Service worker — GitHub + Groq API bridge
│   ├── content.js               # GitHub page injection (button + iframe sidebar)
│   ├── sidebar.js               # Extension sidebar UI & tab rendering
│   ├── sidebar.html             # Sidebar markup
│   ├── sidebar.css              # Sidebar styles
│   └── services.js              # GitHub API helpers (loaded as plain script)
├── assets/
│   └── banner.png               # README banner image
├── index.html                   # Vite entry HTML
├── vite.config.js               # Vite + React plugin
├── package.json                 # 3 runtime deps: react, react-dom, @tabler/icons-react
└── LICENSE                      # MIT License
```

### Data Flow

```
User pastes GitHub URL
        │
        ▼
   ┌─────────┐     ┌──────────────────┐
   │ Navbar   │────▶│     App.jsx      │
   └─────────┘     │  (state manager) │
                    └───────┬──────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ GitHub   │  │  Groq    │  │ Sidebar  │
        │   API    │  │   API    │  │ + Panels │
        └────┬─────┘  └────┬─────┘  └──────────┘
             │              │
             ▼              ▼
        File tree      4 parallel AI
        + content      analyses per file
             │              │
             └──────┬───────┘
                    ▼
             ┌──────────┐
             │ Analysis  │
             │   Cache   │ (in-memory, per path)
             └──────────┘
```

---

## 🛠️ Tech Stack

| Category | Technology | Why |
|----------|-----------|-----|
| **UI** | React 18 | Component-based, lightweight |
| **Build** | Vite 5 | Fast HMR, zero-config |
| **Styling** | CSS Modules + Vanilla CSS | Scoped styles, no runtime overhead |
| **Icons** | Tabler Icons (React) | 5,000+ consistent open-source icons |
| **AI** | Groq + LLaMA 3.3 70B | Blazing-fast inference, structured JSON output |
| **Data** | GitHub REST API | Universal access to public repos |
| **Extension** | Chrome MV3 | Modern, secure extension platform |

**Zero heavyweight dependencies** — the entire web app runs on just 3 runtime packages.

---

## 📝 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GITHUB_TOKEN` | Recommended | GitHub PAT for higher rate limits (60 → 5,000 req/hr) |
| `VITE_GROQ_API_KEY` | **Yes** | Groq API key for AI file analysis |

---

## 🗺️ Roadmap

- [ ] **Repo-level summary** — AI overview of the entire repository
- [ ] **Search within tree** — filter the file tree by filename
- [ ] **Multi-file analysis** — analyze relationships between files
- [ ] **Export report** — generate a PDF/Markdown report of the analysis
- [ ] **Private repo support** — OAuth flow for authenticated access
- [ ] **URL-based routing** — deep-link to specific files within a repo
- [ ] **Server-side proxy** — move API keys out of the client bundle

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feat/my-feature`
3. **Commit** your changes: `git commit -m "feat: add my feature"`
4. **Push** to the branch: `git push origin feat/my-feature`
5. **Open** a Pull Request

### Project Conventions

- **CSS Modules** for component styles (`.module.css`)
- **Satoshi** font for headings, **Inter** for body text
- **GitHub dark theme** color palette (`--bg: #0d1117`, `--accent: #58a6ff`)
- **Tabler Icons** (React) for all iconography

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  <strong>Built with ☕ and curiosity</strong><br/>
  <sub>If you find RepoLens useful, consider giving it a ⭐</sub>
</p>
