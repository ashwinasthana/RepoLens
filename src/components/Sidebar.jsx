import { useState } from 'react'
import styles from './Sidebar.module.css'

function buildTree(items) {
  const root = {}
  for (const item of items) {
    const parts = item.path.split('/')
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!node[part]) node[part] = i === parts.length - 1 ? null : {}
      if (node[part] !== null) node = node[part]
    }
  }
  return root
}

function TreeNode({ name, node, path, onSelect, selectedPath }) {
  const [open, setOpen] = useState(true)
  const isDir = node !== null && typeof node === 'object'
  const fullPath = path ? `${path}/${name}` : name

  if (!isDir) {
    return (
      <div
        className={`${styles.file} ${selectedPath === fullPath ? styles.active : ''}`}
        onClick={() => onSelect(fullPath)}
      >
        📄 {name}
      </div>
    )
  }

  return (
    <div className={styles.dir}>
      <div className={styles.dirLabel} onClick={() => setOpen(o => !o)}>
        {open ? '▾' : '▸'} 📁 {name}
      </div>
      {open && (
        <div className={styles.children}>
          {Object.entries(node).map(([k, v]) => (
            <TreeNode key={k} name={k} node={v} path={fullPath} onSelect={onSelect} selectedPath={selectedPath} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ tree, onSelectFile, selectedFile, collapsed, onToggle }) {
  const treeData = tree ? buildTree(tree) : null

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        {!collapsed && <span>Files</span>}
        <button className={styles.toggle} onClick={onToggle} title="Toggle sidebar">
          {collapsed ? '›' : '‹'}
        </button>
      </div>
      {!collapsed && (
        <div className={styles.tree}>
          {!treeData ? (
            <span className={styles.empty}>No repo loaded</span>
          ) : (
            Object.entries(treeData).map(([k, v]) => (
              <TreeNode key={k} name={k} node={v} path="" onSelect={onSelectFile} selectedPath={selectedFile} />
            ))
          )}
        </div>
      )}
    </aside>
  )
}
