import { useState, useMemo } from 'react'
import {
  IconFile, IconFolder, IconFolderOpen,
  IconBrandJavascript, IconBrandTypescript, IconBrandReact,
  IconBrandPython, IconMarkdown, IconBraces, IconBrandHtml5,
  IconBrandCss3, IconTerminal, IconDatabase, IconChevronRight,
  IconLayoutSidebar, IconLayoutSidebarFilled,
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
        <span className={styles.icon}><FileIcon name={node.name} /></span>
        <span className={styles.label}>{node.name}</span>
      </div>
    )
  }

  const FolderIcon = open ? IconFolderOpen : IconFolder

  return (
    <div>
      <div
        className={styles.row}
        style={{ paddingLeft: 12 + indent }}
        onClick={() => setOpen(o => !o)}
      >
        <span className={`${styles.arrow} ${open ? styles.arrowOpen : ''}`}>
          <IconChevronRight size={12} stroke={2} />
        </span>
        <span className={styles.folderIcon}>
          <FolderIcon size={15} stroke={1.5} />
        </span>
        <span className={styles.folderName}>{node.name}</span>
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
