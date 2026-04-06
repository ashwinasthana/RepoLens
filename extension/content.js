// content.js — RepoLens button + sidebar injection for github.com

(function () {
  'use strict'

  let iframe = null
  let injectTimer = null

  // ── Helpers ────────────────────────────────────────────────────────────────

  function isRepoPage() {
    const parts = location.pathname.replace(/^\//, '').split('/').filter(Boolean)
    // Need at least owner + repo; exclude known non-repo paths
    const NON_REPO = new Set(['settings', 'marketplace', 'explore', 'trending', 'notifications', 'issues', 'pulls'])
    return parts.length >= 2 && !NON_REPO.has(parts[0])
  }

  function alreadyInjected() {
    return !!document.getElementById('repolens-btn')
  }

  // ── Button injection ───────────────────────────────────────────────────────

  function injectButton() {
    if (!isRepoPage() || alreadyInjected()) return

    const btn = document.createElement('button')
    btn.id = 'repolens-btn'
    btn.textContent = '🔍 RepoLens'
    btn.setAttribute('aria-label', 'Open RepoLens sidebar')

    Object.assign(btn.style, {
      position:     'fixed',
      top:          '70px',
      right:        '20px',
      zIndex:       '9999',
      padding:      '8px 14px',
      background:   '#238636',
      color:        '#ffffff',
      border:       '1px solid rgba(240,246,252,0.1)',
      borderRadius: '6px',
      fontFamily:   '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize:     '13px',
      fontWeight:   '600',
      cursor:       'pointer',
      boxShadow:    '0 4px 12px rgba(0,0,0,0.4)',
      transition:   'background 0.15s ease, transform 0.15s ease',
      lineHeight:   '1.4',
    })

    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#2ea043'
      btn.style.transform  = 'scale(1.03)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#238636'
      btn.style.transform  = 'scale(1)'
    })
    btn.addEventListener('click', openSidebar)

    document.body.appendChild(btn)
  }

  // Debounced inject — GitHub fires many DOM mutations per navigation
  function scheduleInject(delay) {
    clearTimeout(injectTimer)
    injectTimer = setTimeout(injectButton, delay ?? 500)
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────

  function openSidebar() {
    // If already open just ensure it's visible
    if (iframe) {
      iframe.style.transform = 'translateX(0)'
      return
    }

    iframe = document.createElement('iframe')
    iframe.id  = 'repolens-sidebar'
    iframe.src = chrome.runtime.getURL('sidebar.html') +
                 '?repoUrl=' + encodeURIComponent(location.href)

    Object.assign(iframe.style, {
      position:   'fixed',
      top:        '0',
      right:      '0',
      width:      '400px',
      height:     '100vh',
      zIndex:     '10000',          // above the button
      border:     'none',
      boxShadow:  '-4px 0 24px rgba(0,0,0,0.5)',
      transform:  'translateX(100%)',
      transition: 'transform 0.25s ease',
    })

    document.body.appendChild(iframe)

    // Double rAF ensures the browser has painted the initial transform
    // before we flip it, so the CSS transition actually fires
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        iframe.style.transform = 'translateX(0)'
      })
    )
  }

  function closeSidebar() {
    if (!iframe) return
    iframe.style.transform = 'translateX(100%)'
    iframe.addEventListener(
      'transitionend',
      () => { iframe.remove(); iframe = null },
      { once: true }
    )
  }

  // ── Message listener (close from inside iframe) ────────────────────────────

  window.addEventListener('message', (e) => {
    if (e.data === 'REPOLENS_CLOSE') closeSidebar()
  })

  // ── SPA navigation — MutationObserver ─────────────────────────────────────
  // GitHub uses Turbo Drive: it swaps <main> content but keeps <body>.
  // Observing the entire subtree catches those deep replacements.

  const observer = new MutationObserver(() => {
    if (!alreadyInjected()) scheduleInject(500)
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree:   true,
  })

  // ── SPA navigation — popstate (back/forward) ───────────────────────────────

  window.addEventListener('popstate', () => {
    // Remove stale button so it gets re-evaluated for the new URL
    const old = document.getElementById('repolens-btn')
    if (old) old.remove()
    scheduleInject(500)
  })

  // ── Initial inject ─────────────────────────────────────────────────────────
  // document_idle means DOM is ready; inject immediately on first load

  injectButton()

})()
