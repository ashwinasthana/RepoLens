import { useState } from 'react'
import styles from './Sidebar.module.css'

function TreeNode({ node, onSelect, selectedPath }) {
  const [open, setOpen] = useState(true)
  const isDir = node.type === 'tree'

  if (!isDir) {
    return (
      <div
        className={`${styles.file} ${selectedPath === node.path ? styles.active : ''}`}
        onClick={() => onSelect(node.path)}
      >
        📄 {node.name}
      </div>
    )
  }

  return (
    <div className={styles.dir}>
      <div className={styles.dirLabel} onClick={() => setOpen(o => !o)}>
        {open ? '▾' : '▸'} 📁 {node.name}
      </div>
      {open && (
        <div className={styles.children}>
          {node.children.map(child => (
            <TreeNode key={child.path} node={child} onSelect={onSelect} selectedPath={selectedPath} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ tree, onSelectFile, selectedFile, collapsed, onToggle }) {
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
          {!tree ? (
            <span className={styles.empty}>No repo loaded</span>
          ) : (
            tree.children.map(child => (
              <TreeNode key={child.path} node={child} onSelect={onSelectFile} selectedPath={selectedFile} />
            ))
          )}
        </div>
      )}
    </aside>
  )
}
