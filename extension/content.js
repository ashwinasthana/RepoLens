// content.js — RepoLens button + sidebar injection for github.com
(function () {
  'use strict'

  // Guard: chrome.runtime must be available (can be missing if extension reloaded mid-session)
  if (typeof chrome === 'undefined' || !chrome.runtime) return

  let iframe = null
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
    btn.id          = 'repolens-btn'
    btn.textContent = '🔍 RepoLens'

    Object.assign(btn.style, {
      all:          'unset',           // reset ALL GitHub CSS that might bleed in
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
      lineHeight:   '1.4',
      display:      'block',
    })

    btn.addEventListener('mouseenter', () => { btn.style.background = '#2ea043' })
    btn.addEventListener('mouseleave', () => { btn.style.background = '#238636' })
    btn.addEventListener('click', openSidebar)

    document.body.appendChild(btn)
    console.log('[RepoLens] button injected on', location.pathname)
  }

  function scheduleInject(delay) {
    clearTimeout(injectTimer)
    injectTimer = setTimeout(injectButton, delay ?? 500)
  }

  // ── Sidebar iframe ─────────────────────────────────────────────────────────

  function openSidebar() {
    console.log('[RepoLens] openSidebar called')

    if (iframe) {
      iframe.style.transform = 'translateX(0)'
      return
    }

    try {
      const sidebarUrl = chrome.runtime.getURL('sidebar.html') +
                         '?repoUrl=' + encodeURIComponent(location.href)

      iframe = document.createElement('iframe')
      iframe.id  = 'repolens-sidebar'
      iframe.src = sidebarUrl

      Object.assign(iframe.style, {
        all:        'unset',           // reset any inherited styles
        position:   'fixed',
        top:        '0',
        right:      '0',
        width:      '400px',
        height:     '100vh',
        zIndex:     '10000',
        border:     'none',
        boxShadow:  '-4px 0 24px rgba(0,0,0,0.5)',
        transform:  'translateX(100%)',
        transition: 'transform 0.25s ease',
        display:    'block',
      })

      document.body.appendChild(iframe)
      console.log('[RepoLens] iframe appended, src =', sidebarUrl)

      // Double rAF so the initial transform is painted before we animate
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          iframe.style.transform = 'translateX(0)'
        })
      )
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

  // Turbo Drive swaps deep DOM nodes — subtree:true catches it
  const observer = new MutationObserver(() => {
    if (!alreadyInjected()) scheduleInject(500)
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  // ── Initial inject ─────────────────────────────────────────────────────────
  injectButton()

})()
