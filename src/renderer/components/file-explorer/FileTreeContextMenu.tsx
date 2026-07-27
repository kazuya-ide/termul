import type { DirectoryEntry } from '@shared/types/filesystem.types'
import {
  ClipboardPaste,
  Copy,
  Edit2,
  ExternalLink,
  FilePlus,
  Files,
  FolderOpen,
  FolderPlus,
  Scissors,
  Terminal,
  Trash2
} from 'lucide-react'
import type { ContextMenuItem } from '@/components/ContextMenu'
import { ContextMenu } from '@/components/ContextMenu'

interface FileTreeContextMenuProps {
  entry: DirectoryEntry
  x: number
  y: number
  onClose: () => void
  onNewFile: (dirPath: string) => void
  onNewFolder: (dirPath: string) => void
  onRename: (entry: DirectoryEntry) => void
  onDelete: (entry: DirectoryEntry) => void
  onCopyPath: (path: string) => void
  onCopy: () => void
  onCut: () => void
  onPaste: (destinationPath: string) => void
  onDuplicate: () => void
  onOpenInTerminal: (dirPath: string) => void
  onOpenWithExternal: (filePath: string) => void
  onShowInFileManager: (path: string) => void
  selectedCount?: number
  hasClipboardContent?: boolean
}

export function FileTreeContextMenu({
  entry,
  x,
  y,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onCopyPath,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onOpenInTerminal,
  onOpenWithExternal,
  onShowInFileManager,
  selectedCount = 1,
  hasClipboardContent = false
}: FileTreeContextMenuProps): React.JSX.Element {
  const items: ContextMenuItem[] = []
  const isDir = entry.type === 'directory'
  const selectionSuffix = selectedCount > 1 ? `（${selectedCount}件）` : ''

  // New File/Folder (directories only)
  if (isDir) {
    items.push(
      {
        label: '新規ファイル',
        icon: <FilePlus size={14} />,
        onClick: () => onNewFile(entry.path)
      },
      {
        label: '新規フォルダ',
        icon: <FolderPlus size={14} />,
        onClick: () => onNewFolder(entry.path)
      },
      { type: 'separator' }
    )
  }

  // Clipboard operations
  items.push(
    {
      label: `コピー${selectionSuffix}`,
      icon: <Copy size={14} />,
      onClick: () => onCopy()
    },
    {
      label: `切り取り${selectionSuffix}`,
      icon: <Scissors size={14} />,
      onClick: () => onCut()
    }
  )

  // Paste (only when clipboard has content and we're on a directory)
  if (hasClipboardContent && isDir) {
    items.push({
      label: '貼り付け',
      icon: <ClipboardPaste size={14} />,
      onClick: () => onPaste(entry.path)
    })
  }

  items.push(
    {
      label: `複製${selectionSuffix}`,
      icon: <Files size={14} />,
      onClick: () => onDuplicate()
    },
    { type: 'separator' },
    {
      label: `名前を変更${selectedCount > 1 ? '（1件のみ）' : ''}`,
      icon: <Edit2 size={14} />,
      onClick: () => onRename(entry),
      disabled: selectedCount > 1
    },
    {
      label: `削除${selectionSuffix}`,
      icon: <Trash2 size={14} />,
      onClick: () => onDelete(entry),
      variant: 'danger'
    },
    { type: 'separator' },
    {
      label: 'パスをコピー',
      icon: <Copy size={14} />,
      onClick: () => onCopyPath(entry.path)
    }
  )

  // External operations
  items.push({ type: 'separator' })

  // Open in Terminal (directories only)
  if (isDir) {
    items.push({
      label: 'ターミナルで開く',
      icon: <Terminal size={14} />,
      onClick: () => onOpenInTerminal(entry.path)
    })
  }

  // Open with External App (files only)
  if (!isDir) {
    items.push({
      label: '外部アプリで開く',
      icon: <ExternalLink size={14} />,
      onClick: () => onOpenWithExternal(entry.path)
    })
  }

  // Show in File Manager (always visible)
  items.push({
    label: 'ファイルマネージャーで表示',
    icon: <FolderOpen size={14} />,
    onClick: () => onShowInFileManager(entry.path)
  })

  return <ContextMenu items={items} x={x} y={y} onClose={onClose} />
}
