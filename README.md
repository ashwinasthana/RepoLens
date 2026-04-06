<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Groq-LLaMA_3.3-F55036?style=for-the-badge&logo=meta&logoColor=white" alt="Groq" />
  <img src="https://img.shields.io/badge/Chrome-Extension_MV3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
</p>

# 🔍 RepoLens

**Understand any GitHub repository in seconds.** Paste a repo URL, browse its file tree, and get instant AI-powered explanations of what every file does — right in your browser.

RepoLens ships as both a **standalone web app** and a **Chrome extension** that embeds directly into GitHub.

---

## ✨ Features

- **🌲 Interactive File Tree** — Browse any public GitHub repo with a collapsible, searchable sidebar
- **🤖 AI File Analysis** — Get instant, structured breakdowns of any file: purpose, summary, complexity, key exports, and suggested next reads
- **📊 File Stats at a Glance** — Line count, file size, language detection, and entry-point identification
- **🔗 Dependency Mapping** — Auto-detects `import`/`require` statements and categorizes them as local vs. npm
- **🧩 Chrome Extension** — Injects a RepoLens sidebar directly into GitHub pages — no context switching
- **📱 Responsive Design** — Mobile-friendly with a slide-out drawer for the file tree
- **🌙 Dark Theme** — GitHub-inspired dark UI that's easy on the eyes

---

## 🏗️ Architecture

```
RepoLens/
├── src/
│   ├── main.jsx                 # App entry point
│   ├── App.jsx                  # Central state hub & orchestrator
│   ├── index.css                # Global styles
│   ├── App.module.css            # App layout styles
│   ├── components/
│   │   ├── Navbar.jsx           # URL input bar + mobile menu
│   │   ├── Sidebar.jsx          # Recursive file tree with icons
│   │   ├── MainPanel.jsx        # Tab container for file details
│   │   ├── FileDetail.jsx       # Stats, AI summary, deps, exports
│   │   └── StatusBar.jsx        # Repo metadata footer
│   └── services/
│       ├── github.js            # GitHub API client (tree, content, metadata)
│       └── ai.js                # Groq LLaMA 3.3 integration
├── extension/                   # Chrome MV3 Extension
│   ├── manifest.json
│   ├── background.js            # Service worker with Groq AI
│   ├── content.js               # GitHub page injection
│   ├── sidebar.js               # Extension sidebar UI
│   ├── sidebar.html
│   ├── sidebar.css
│   └── services.js              # GitHub API helpers
├── index.html
├── vite.config.js
└── package.json
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
        └──────────┘  └──────────┘  └──────────┘
```

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
4. Navigate to any GitHub repository — you'll see a **RepoLens** button injected into the page
5. Click it to open the AI-powered sidebar

> **Note:** The extension requires a Groq API key stored in Chrome's extension storage. You'll be prompted to enter it on first use.

---

## 🤖 How the AI Works

RepoLens uses **Groq's** inference API running **LLaMA 3.3 70B** to analyze files. When you click on a file:

1. The file content is fetched from GitHub (first 3,000 characters)
2. A structured prompt is sent to Groq asking for JSON output
3. The AI returns:
   - **Summary** — 2-3 sentence explanation
   - **Purpose** — single-line description of the file's job
   - **Key Exports** — main functions/classes exported
   - **Complexity** — low / medium / high rating
   - **Suggested Next Files** — what to read after this file

The response is parsed and rendered in the FileDetail panel with stats cards, dependency pills, and export lists.

---

## 🛠️ Tech Stack

| Category | Technology | Why |
|----------|-----------|-----|
| **UI** | React 18 | Component-based, lightweight |
| **Build** | Vite 5 | Fast HMR, zero-config |
| **Styling** | CSS Modules | Scoped styles, no runtime overhead |
| **AI** | Groq + LLaMA 3.3 70B | Fast inference, structured output |
| **Data** | GitHub REST API | Universal access to public repos |
| **Extension** | Chrome MV3 | Modern, secure extension platform |

**Zero heavyweight dependencies** — the entire app runs on just `react` and `react-dom`.

---

## 📝 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GITHUB_TOKEN` | Recommended | GitHub PAT for higher rate limits (60 → 5,000 req/hr) |
| `VITE_GROQ_API_KEY` | Yes | Groq API key for AI file analysis |

---

## 🗺️ Roadmap

- [ ] **Repo-level summary** — AI overview of the entire repository
- [ ] **File content caching** — avoid re-fetching and re-analyzing files
- [ ] **Search within tree** — filter the file tree by filename
- [ ] **Multi-file analysis** — analyze relationships between files
- [ ] **Export report** — generate a PDF/Markdown report of the analysis
- [ ] **Private repo support** — OAuth flow for authenticated access
- [ ] **URL-based routing** — deep-link to specific files within a repo

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feat/my-feature`
3. **Commit** your changes: `git commit -m "feat: add my feature"`
4. **Push** to the branch: `git push origin feat/my-feature`
5. **Open** a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  <strong>Built with ☕ and curiosity</strong>
</p>
