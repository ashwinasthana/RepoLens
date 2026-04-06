import { useState, useMemo } from 'react'
import styles from './Sidebar.module.css'

const EXT_ICON = {
  js: '🟨', jsx: '🟨',
  ts: '🔷', tsx: '🔷',
  py: '🐍',
  md: '📝',
  json: '{}',
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase()
  return EXT_ICON[ext] ?? '📄'
}

function countNodes(node) {
  let files = 0, folders = 0
  for (const child of node.children ?? []) {
    if (child.type === 'tree') { folders++; const c = countNodes(child); files += c.files; folders += c.folders }
    else files++
  }
  return { files, folders }
}

function TreeNode({ node, depth, onFileClick, selectedFile }) {
  const [open, setOpen] = useState(depth < 2)
  const isDir = node.type === 'tree'
  const indent = depth * 16

  if (!isDir) {
    const selected = selectedFile === node.path
    return (
      <div
        className={`${styles.row} ${selected ? styles.selected : ''}`}
        style={{ paddingLeft: 12 + indent }}
        onClick={() => onFileClick(node)}
        title={node.path}
      >
        <span className={styles.icon}>{fileIcon(node.name)}</span>
        <span className={styles.label}>{node.name}</span>
      </div>
    )
  }

  return (
    <div>
      <div
        className={styles.row}
        style={{ paddingLeft: 12 + indent }}
        onClick={() => setOpen(o => !o)}
      >
        <span className={`${styles.arrow} ${open ? styles.arrowOpen : ''}`}>▸</span>
        <span className={`${styles.icon} ${styles.folderIcon}`}>{node.name}</span>
      </div>
      <div className={`${styles.children} ${open ? styles.childrenOpen : ''}`}>
        {node.children.map(child => (
          <TreeNode
            key={child.path || child.name}
            node={child}
            depth={depth + 1}
            onFileClick={onFileClick}
            selectedFile={selectedFile}
          />
        ))}
      </div>
    </div>
  )
}

export default function Sidebar({ tree, onFileClick, selectedFile, collapsed, onToggle, drawerOpen, onDrawerClose }) {
  const counts = useMemo(() => tree ? countNodes(tree) : { files: 0, folders: 0 }, [tree])

  return (
    <>
      {drawerOpen && <div className={styles.backdrop} onClick={onDrawerClose} />}
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${drawerOpen ? styles.drawerOpen : ''}`}>
      <div className={styles.header}>
        {!collapsed && <span>Files</span>}
        <button className={styles.toggle} onClick={onToggle} title="Toggle sidebar">
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {!collapsed && (
        <>
          {tree && (
            <div className={styles.counts}>
              {counts.files} files, {counts.folders} folders
            </div>
          )}
          <div className={styles.tree}>
            {!tree ? (
              <span className={styles.empty}>No repo loaded</span>
            ) : (
              tree.children.map(child => (
                <TreeNode
                  key={child.path || child.name}
                  node={child}
                  depth={0}
                  onFileClick={onFileClick}
                  selectedFile={selectedFile}
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
