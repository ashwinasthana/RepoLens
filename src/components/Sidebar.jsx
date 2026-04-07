import { useState, useMemo } from 'react'
import {
  IconFile, IconFolder, IconFolderOpen,
  IconBrandJavascript, IconBrandTypescript, IconBrandReact,
  IconBrandPython, IconMarkdown, IconBraces, IconBrandHtml5,
  IconBrandCss3, IconTerminal, IconDatabase, IconChevronRight,
  IconLayoutSidebar, IconLayoutSidebarFilled, IconSearch, IconX,
} from '@tabler/icons-react'
import styles from './Sidebar.module.css'

const EXT_ICON = {
  js:   IconBrandJavascript,
  jsx:  IconBrandReact,
  ts:   IconBrandTypescript,
  tsx:  IconBrandReact,
  py:   IconBrandPython,
  md:   IconMarkdown,
  json: IconBraces,
  html: IconBrandHtml5,
  css:  IconBrandCss3,
  sh:   IconTerminal,
  sql:  IconDatabase,
}

function FileIcon({ name, size = 15 }) {
  const ext = name.split('.').pop().toLowerCase()
  const Icon = EXT_ICON[ext] ?? IconFile
  return <Icon size={size} stroke={1.5} />
}

function countNodes(node) {
  let files = 0, folders = 0
  for (const child of node.children ?? []) {
    if (child.type === 'tree') { folders++; const c = countNodes(child); files += c.files; folders += c.folders }
    else files++
  }
  return { files, folders }
}

// Filter tree to only include nodes matching the search query
function filterTree(node, query) {
  if (!query) return node
  const q = query.toLowerCase()

  if (node.type !== 'tree') {
    return node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q) ? node : null
  }

  const filteredChildren = (node.children ?? [])
    .map(child => filterTree(child, query))
    .filter(Boolean)

  if (filteredChildren.length === 0) return null
  return { ...node, children: filteredChildren }
}

function TreeNode({ node, depth, onFileClick, selectedFile, forceOpen }) {
  const [open, setOpen] = useState(depth < 2)
  const isDir = node.type === 'tree'
  const indent = depth * 16
  const isOpen = forceOpen || open

  if (!isDir) {
    const selected = selectedFile === node.path
    return (
      <div
        className={`${styles.row} ${selected ? styles.selected : ''}`}
        style={{ paddingLeft: 12 + indent }}
        onClick={() => onFileClick(node)}
        title={node.path}
      >
        <span className={styles.icon}><FileIcon name={node.name} /></span>
        <span className={styles.label}>{node.name}</span>
      </div>
    )
  }

  const FolderIcon = isOpen ? IconFolderOpen : IconFolder

  return (
    <div>
      <div
        className={styles.row}
        style={{ paddingLeft: 12 + indent }}
        onClick={() => setOpen(o => !o)}
      >
        <span className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}>
          <IconChevronRight size={12} stroke={2} />
        </span>
        <span className={styles.folderIcon}>
          <FolderIcon size={15} stroke={1.5} />
        </span>
        <span className={styles.folderName}>{node.name}</span>
      </div>
      <div className={`${styles.children} ${isOpen ? styles.childrenOpen : ''}`}>
        {node.children.map(child => (
          <TreeNode
            key={child.path || child.name}
            node={child}
            depth={depth + 1}
            onFileClick={onFileClick}
            selectedFile={selectedFile}
            forceOpen={forceOpen}
          />
        ))}
      </div>
    </div>
  )
}

export default function Sidebar({ tree, onFileClick, selectedFile, collapsed, onToggle, drawerOpen, onDrawerClose }) {
  const [search, setSearch] = useState('')
  const counts = useMemo(() => tree ? countNodes(tree) : { files: 0, folders: 0 }, [tree])

  const filteredTree = useMemo(() => {
    if (!tree || !search.trim()) return tree
    return filterTree(tree, search.trim())
  }, [tree, search])

  const ToggleIcon = collapsed ? IconLayoutSidebar : IconLayoutSidebarFilled

  return (
    <>
      {drawerOpen && <div className={styles.backdrop} onClick={onDrawerClose} />}
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${drawerOpen ? styles.drawerOpen : ''}`}>
      <div className={styles.header}>
        {!collapsed && <span className={styles.headerTitle}>Files</span>}
        <button className={styles.toggle} onClick={onToggle} title="Toggle sidebar">
          <ToggleIcon size={16} stroke={1.5} />
        </button>
      </div>

      {!collapsed && (
        <>
          {tree && (
            <>
              <div className={styles.counts}>
                {counts.files} files, {counts.folders} folders
              </div>
              {/* Search input */}
              <div className={styles.searchWrap}>
                <IconSearch size={13} stroke={1.5} className={styles.searchIcon} />
                <input
                  className={styles.searchInput}
                  placeholder="Search files…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button className={styles.searchClear} onClick={() => setSearch('')}>
                    <IconX size={12} stroke={2} />
                  </button>
                )}
              </div>
            </>
          )}
          <div className={styles.tree}>
            {!filteredTree ? (
              <span className={styles.empty}>No repo loaded</span>
            ) : !filteredTree.children?.length ? (
              <span className={styles.empty}>No files match "{search}"</span>
            ) : (
              filteredTree.children.map(child => (
                <TreeNode
                  key={child.path || child.name}
                  node={child}
                  depth={0}
                  onFileClick={onFileClick}
                  selectedFile={selectedFile}
                  forceOpen={!!search}
                />
              ))
            )}
          </div>
        </>
      )}
    </aside>
    </>  
  )
}
