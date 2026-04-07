// content.js — RepoLens button + sidebar injection for github.com
(function () {
  'use strict'

  if (typeof chrome === 'undefined' || !chrome.runtime) return

  let iframe     = null
  let resizeBar  = null
  let injectTimer = null

  function isRepoPage() {
    const parts = location.pathname.replace(/^\//, '').split('/').filter(Boolean)
    const NON_REPO = new Set(['settings','marketplace','explore','trending','notifications','issues','pulls','login','signup','orgs','sponsors'])
    return parts.length >= 2 && !NON_REPO.has(parts[0])
  }

  function alreadyInjected() {
    return !!document.getElementById('repolens-btn')
  }

  // ── Button ─────────────────────────────────────────────────────────────────

  function injectButton() {
    if (!isRepoPage() || alreadyInjected()) return

    const btn = document.createElement('button')
    btn.id = 'repolens-btn'
    btn.innerHTML = '🔍 <strong>RepoLens</strong>'

    Object.assign(btn.style, {
      all:          'unset',
      position:     'fixed',
      top:          '70px',
      right:        '20px',
      zIndex:       '9999',
      padding:      '8px 16px',
      background:   'linear-gradient(135deg, #58a6ff 0%, #4d96e8 100%)',
      color:        '#0d1117',
      border:       '1px solid rgba(88,166,255,0.3)',
      borderRadius: '8px',
      fontFamily:   'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize:     '13px',
      fontWeight:   '600',
      cursor:       'pointer',
      boxShadow:    '0 4px 16px rgba(88,166,255,0.3), 0 1px 3px rgba(0,0,0,0.2)',
      lineHeight:   '1.4',
      display:      'flex',
      alignItems:   'center',
      gap:          '4px',
      transition:   'all 0.2s ease',
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
    btn.addEventListener('click', openSidebar)

    document.body.appendChild(btn)
    console.log('[RepoLens] button injected on', location.pathname)
  }

  function scheduleInject(delay) {
    clearTimeout(injectTimer)
    injectTimer = setTimeout(injectButton, delay ?? 500)
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────

  function openSidebar() {
    console.log('[RepoLens] openSidebar called')
    if (iframe) { iframe.style.transform = 'translateX(0)'; return }

    try {
      const sidebarUrl = chrome.runtime.getURL('sidebar.html') +
                         '?repoUrl=' + encodeURIComponent(location.href)

      iframe = document.createElement('iframe')
      iframe.id  = 'repolens-sidebar'
      iframe.src = sidebarUrl

      Object.assign(iframe.style, {
        all:        'unset',
        position:   'fixed',
        top:        '0',
        right:      '0',
        width:      '420px',
        height:     '100vh',
        zIndex:     '10000',
        border:     'none',
        boxShadow:  '-4px 0 32px rgba(0,0,0,0.6)',
        transform:  'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display:    'block',
      })

      document.body.appendChild(iframe)

      // ── Resize handle ───────────────────────────────────────────────────
      resizeBar = document.createElement('div')
      Object.assign(resizeBar.style, {
        position:   'fixed',
        top:        '0',
        right:      '420px',
        width:      '6px',
        height:     '100vh',
        zIndex:     '10001',
        cursor:     'ew-resize',
        background: 'transparent',
        transition: 'background 0.15s',
      })
      resizeBar.addEventListener('mouseenter', () => { resizeBar.style.background = 'rgba(88,166,255,0.4)' })
      resizeBar.addEventListener('mouseleave', () => { resizeBar.style.background = 'transparent' })
      document.body.appendChild(resizeBar)

      let startX = 0, startW = 0
      resizeBar.addEventListener('mousedown', (e) => {
        startX = e.clientX
        startW = parseInt(iframe.style.width, 10)
        document.body.style.userSelect = 'none'
        iframe.style.pointerEvents = 'none'
        resizeBar.style.background = 'rgba(88,166,255,0.6)'
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
      })

      function onMouseMove(e) {
        const newW = Math.min(800, Math.max(320, startW + (startX - e.clientX)))
        iframe.style.width    = newW + 'px'
        resizeBar.style.right = newW + 'px'
      }

      function onMouseUp() {
        document.body.style.userSelect = ''
        iframe.style.pointerEvents = 'auto'
        resizeBar.style.background = 'transparent'
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
      // ────────────────────────────────────────────────────────────────────

      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          iframe.style.transform = 'translateX(0)'
        })
      )

      console.log('[RepoLens] iframe + resize handle appended')
    } catch (err) {
      console.error('[RepoLens] openSidebar error:', err)
    }
  }

  function closeSidebar() {
    if (!iframe) return
    iframe.style.transform = 'translateX(100%)'
    iframe.addEventListener('transitionend', () => {
      iframe.remove()
      iframe = null
      if (resizeBar) { resizeBar.remove(); resizeBar = null }
    }, { once: true })
  }

  // ── Listeners ──────────────────────────────────────────────────────────────

  window.addEventListener('message', (e) => {
    if (e.data === 'REPOLENS_CLOSE') closeSidebar()
  })

  window.addEventListener('popstate', () => {
    const old = document.getElementById('repolens-btn')
    if (old) old.remove()
    scheduleInject(500)
  })

  const observer = new MutationObserver(() => {
    if (!alreadyInjected()) scheduleInject(500)
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  injectButton()

})()
