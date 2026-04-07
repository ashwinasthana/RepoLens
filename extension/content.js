(function () {
  'use strict'

  // Safety: check for valid extension context
  function isContextValid() {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
  }
  if (!isContextValid()) return;

  // Constants
  const SIDEBAR_WIDTH_KEY = 'repolensSidebarWidth'
  const SIDEBAR_MIN_WIDTH = 320
  const SIDEBAR_MAX_WIDTH = 900
  const SIDEBAR_VIEWPORT_GAP = 24
  const NON_REPO = new Set(['settings', 'marketplace', 'explore', 'trending', 'notifications', 'issues', 'pulls', 'login', 'signup', 'orgs', 'sponsors'])

  // State
  let iframe = null
  let resizeBar = null
  let injectTimer = null
  let sidebarWidth = 420
  let lastRepoKey = ''
  let domCheckQueued = false

  function getRepoKeyFromPath(pathname) {
    const parts = String(pathname || '').replace(/^\//, '').split('/').filter(Boolean)
    if (parts.length < 2) return ''
    if (NON_REPO.has(parts[0])) return ''
    return `${parts[0]}/${parts[1]}`
  }

  function isRepoPage() {
    return !!getRepoKeyFromPath(location.pathname)
  }

  function alreadyInjected() {
    return !!document.getElementById('repolens-btn')
  }

  // ── Button ─────────────────────────────────────────────────────────────────

  function injectButton() {
    if (!isRepoPage() || alreadyInjected() || !!iframe) return

    const btn = document.createElement('button')
    btn.id = 'repolens-btn'
    btn.innerHTML = '🔍 <strong>RepoLens</strong>'

    Object.assign(btn.style, {
      all: 'unset',
      position: 'fixed',
      top: '70px',
      right: '20px',
      zIndex: '2147483647',
      padding: '8px 16px',
      background: 'linear-gradient(135deg, #58a6ff 0%, #4d96e8 100%)',
      color: '#0d1117',
      border: '1px solid rgba(88,166,255,0.3)',
      borderRadius: '8px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(88,166,255,0.3), 0 1px 3px rgba(0,0,0,0.2)',
      lineHeight: '1.4',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      pointerEvents: 'auto',
      userSelect: 'none',
    })

    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'linear-gradient(135deg, #79b8ff 0%, #58a6ff 100%)'
      btn.style.boxShadow = '0 6px 20px rgba(88,166,255,0.4), 0 2px 6px rgba(0,0,0,0.3)'
      btn.style.transform = 'translateY(-2px)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'linear-gradient(135deg, #58a6ff 0%, #4d96e8 100%)'
      btn.style.boxShadow = '0 4px 16px rgba(88,166,255,0.3), 0 1px 3px rgba(0,0,0,0.2)'
      btn.style.transform = 'translateY(0)'
    })
    btn.addEventListener('click', () => {
      openSidebar();
    })

    document.body.appendChild(btn)
  }

  function scheduleInject(delay) {
    clearTimeout(injectTimer)
    injectTimer = setTimeout(injectButton, delay ?? 400)
  }

  function handleRouteChange() {
    if (!isContextValid()) return
    const currentRepoKey = getRepoKeyFromPath(location.pathname)
    if (currentRepoKey === lastRepoKey) return

    lastRepoKey = currentRepoKey
    closeSidebar()
    const old = document.getElementById('repolens-btn')
    if (old) old.remove()
    if (currentRepoKey) scheduleInject(200)
  }

  function cleanupDetachedUiRefs() {
    if (iframe && !iframe.isConnected) iframe = null
    if (resizeBar && !resizeBar.isConnected) resizeBar = null
  }

  function applySidebarWidth(width) {
    const maxX = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth - SIDEBAR_VIEWPORT_GAP))
    sidebarWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(maxX, width))
    if (iframe) iframe.style.width = `${sidebarWidth}px`
    if (resizeBar) resizeBar.style.right = `${sidebarWidth}px`
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────

  async function openSidebar() {
    if (!isContextValid()) return
    cleanupDetachedUiRefs()
    if (iframe) return

    // Load width from storage safely
    try {
      const res = await chrome.storage.local.get([SIDEBAR_WIDTH_KEY]);
      if (res[SIDEBAR_WIDTH_KEY]) sidebarWidth = res[SIDEBAR_WIDTH_KEY]
    } catch (e) {
      console.warn('[RepoLens] storage access failed');
    }

    try {
      const sidebarUrl = chrome.runtime.getURL('sidebar.html') +
        '?repoUrl=' + encodeURIComponent(location.href)

      iframe = document.createElement('iframe')
      iframe.id = 'repolens-sidebar'
      iframe.src = sidebarUrl

      Object.assign(iframe.style, {
        all: 'unset',
        position: 'fixed',
        top: '0',
        right: '0',
        width: `${sidebarWidth}px`,
        height: '100vh',
        zIndex: '2147483646',
        border: 'none',
        boxShadow: '-4px 0 32px rgba(0,0,0,0.6)',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'block',
      })

      document.body.appendChild(iframe)

      const btn = document.getElementById('repolens-btn')
      if (btn) btn.style.display = 'none'

      // Resize handle
      resizeBar = document.createElement('div')
      Object.assign(resizeBar.style, {
        position: 'fixed',
        top: '0',
        right: `${sidebarWidth}px`,
        width: '10px',
        height: '100vh',
        zIndex: '2147483647',
        cursor: 'ew-resize',
        background: 'transparent',
      })
      document.body.appendChild(resizeBar)

      let startX = 0, startW = 0, dragging = false
      const onPointerMove = (e) => {
        if (!dragging || !iframe) return
        applySidebarWidth(startW + (startX - e.clientX))
      }
      const onPointerUp = () => {
        if (!dragging) return
        dragging = false
        if (iframe) iframe.style.pointerEvents = 'auto'
        if (isContextValid()) {
          chrome.storage.local.set({ [SIDEBAR_WIDTH_KEY]: sidebarWidth }).catch(() => { });
        }
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
      }

      resizeBar.addEventListener('pointerdown', (e) => {
        startX = e.clientX; startW = sidebarWidth; dragging = true
        e.preventDefault();
        iframe.style.pointerEvents = 'none'
        document.addEventListener('pointermove', onPointerMove)
        document.addEventListener('pointerup', onPointerUp)
      })

      applySidebarWidth(sidebarWidth)
      void iframe.offsetWidth // force reflow
      requestAnimationFrame(() => {
        if (iframe) iframe.style.transform = 'translateX(0)'
      })

    } catch (err) {
      console.warn('[RepoLens] failed to open sidebar', err)
    }
  }

  function closeSidebar() {
    if (!iframe) return
    iframe.style.transform = 'translateX(100%)'
    iframe.addEventListener('transitionend', () => {
      if (iframe) iframe.remove(); iframe = null
      if (resizeBar) { resizeBar.remove(); resizeBar = null }

      const btn = document.getElementById('repolens-btn')
      if (btn) btn.style.display = 'flex'
    }, { once: true })
  }

  // ── Listeners ──────────────────────────────────────────────────────────────

  window.addEventListener('message', (e) => {
    if (e.data === 'REPOLENS_CLOSE') closeSidebar()
  })

  // Popstate/Hashchange handles single-page nav
  window.addEventListener('popstate', handleRouteChange)
  window.addEventListener('hashchange', handleRouteChange)

  // Observer to handle route changes and element persistence
  const observer = new MutationObserver(() => {
    if (domCheckQueued) return
    domCheckQueued = true
    requestAnimationFrame(() => {
      domCheckQueued = false
      if (!isContextValid()) return

      const currentRepoKey = getRepoKeyFromPath(location.pathname)
      if (currentRepoKey !== lastRepoKey) {
        handleRouteChange()
      } else if (!iframe && !alreadyInjected()) {
        scheduleInject(400)
      }
    })
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  // Initial check
  lastRepoKey = getRepoKeyFromPath(location.pathname)
  if (lastRepoKey) injectButton()

})()
