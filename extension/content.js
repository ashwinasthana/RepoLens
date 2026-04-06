// content.js — injected on github.com/*/*

;(function () {
  // Only run on repo root/sub pages — must have owner + repo segments
  const parts = location.pathname.replace(/^\//, '').split('/')
  if (parts.length < 2 || !parts[0] || !parts[1]) return

  // Avoid double-injection on GitHub's SPA navigation
  if (document.getElementById('repolens-btn')) return

  // ── Floating "Analyze" button ─────────────────────────────────────────────
  const btn = document.createElement('button')
  btn.id = 'repolens-btn'
  btn.textContent = '🔍 Analyze with RepoLens'
  Object.assign(btn.style, {
    position:     'fixed',
    top:          '72px',
    right:        '16px',
    zIndex:       '999998',
    padding:      '8px 14px',
    background:   '#58a6ff',
    color:        '#0d1117',
    border:       'none',
    borderRadius: '6px',
    fontFamily:   '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize:     '13px',
    fontWeight:   '600',
    cursor:       'pointer',
    boxShadow:    '0 4px 12px rgba(0,0,0,0.4)',
    transition:   'background 0.15s ease, transform 0.15s ease',
  })
  btn.addEventListener('mouseenter', () => { btn.style.background = '#79b8ff'; btn.style.transform = 'scale(1.03)' })
  btn.addEventListener('mouseleave', () => { btn.style.background = '#58a6ff'; btn.style.transform = 'scale(1)' })
  document.body.appendChild(btn)

  // ── Sidebar iframe ────────────────────────────────────────────────────────
  let iframe = null

  function openSidebar() {
    if (iframe) { iframe.style.transform = 'translateX(0)'; return }

    iframe = document.createElement('iframe')
    iframe.id  = 'repolens-sidebar'
    iframe.src = chrome.runtime.getURL('sidebar.html') + '?repoUrl=' + encodeURIComponent(location.href)
    Object.assign(iframe.style, {
      position:   'fixed',
      top:        '0',
      right:      '0',
      width:      '380px',
      height:     '100vh',
      zIndex:     '999999',
      border:     'none',
      boxShadow:  '-4px 0 24px rgba(0,0,0,0.5)',
      transform:  'translateX(100%)',
      transition: 'transform 0.25s ease',
    })
    document.body.appendChild(iframe)
    // Trigger slide-in after paint
    requestAnimationFrame(() => requestAnimationFrame(() => { iframe.style.transform = 'translateX(0)' }))
  }

  function closeSidebar() {
    if (!iframe) return
    iframe.style.transform = 'translateX(100%)'
    iframe.addEventListener('transitionend', () => { iframe.remove(); iframe = null }, { once: true })
  }

  btn.addEventListener('click', openSidebar)

  // Listen for close message from inside the iframe
  window.addEventListener('message', e => {
    if (e.data === 'REPOLENS_CLOSE') closeSidebar()
  })

  // Re-inject on GitHub SPA navigation (turbo/pjax)
  const observer = new MutationObserver(() => {
    if (!document.getElementById('repolens-btn')) {
      document.body.appendChild(btn)
    }
  })
  observer.observe(document.body, { childList: true, subtree: false })
})()
