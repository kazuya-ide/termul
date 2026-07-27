import type { BranchInfo } from '@shared/types/ipc.types'
import { AlertCircle, ChevronDown, GitBranch, Loader2, Plus, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { gitApi } from '@/lib/git-api'
import { cn } from '@/lib/utils'
import { worktreeApi } from '@/lib/worktree-api'
import { useProjectStore } from '@/stores/project-store'
import { useTerminalStore } from '@/stores/terminal-store'

const statusBarTriggerClass =
  'flex items-center hover:bg-white/10 px-2 py-0.5 rounded cursor-pointer transition-colors'

function sanitizeBranchName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9/_.-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatBranchLoadError(error: string, code?: string): string {
  switch (code) {
    case 'NOT_A_GIT_REPO':
      return 'このフォルダは git リポジトリではありません。'
    case 'GIT_NOT_FOUND':
      return 'Git がインストールされていないか、PATH で利用できません。'
    default:
      return error
  }
}

interface GitBranchPickerProps {
  repoPath: string
  currentBranch: string | null | undefined
  projectId: string
  ahead?: number
  behind?: number
}

export function GitBranchPicker({
  repoPath,
  currentBranch,
  projectId,
  ahead = 0,
  behind = 0
}: GitBranchPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [branchSearch, setBranchSearch] = useState('')
  const [isSwitching, setIsSwitching] = useState(false)
  const [isCreatingMode, setIsCreatingMode] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const branchLoadRequestId = useRef(0)
  const latestRepoPath = useRef(repoPath)
  const latestOpen = useRef(open)
  latestRepoPath.current = repoPath
  latestOpen.current = open

  const updateProject = useProjectStore((state) => state.updateProject)
  const activeTerminalId = useTerminalStore((state) => state.activeTerminalId)
  const updateTerminalGitBranch = useTerminalStore((state) => state.updateTerminalGitBranch)

  const loadBranches = useCallback(async (): Promise<void> => {
    const requestId = branchLoadRequestId.current + 1
    branchLoadRequestId.current = requestId
    const requestRepoPath = repoPath
    const isCurrentRequest = (): boolean =>
      branchLoadRequestId.current === requestId &&
      latestRepoPath.current === requestRepoPath &&
      latestOpen.current

    setBranchesLoading(true)
    setLoadError(null)
    try {
      const result = await worktreeApi.branches(repoPath)
      if (!isCurrentRequest()) return

      if (result.success && result.data) {
        setBranches(result.data)
        setLoadError(null)
      } else if (result.success === false) {
        setBranches([])
        setLoadError(formatBranchLoadError(result.error, result.code))
      } else {
        setBranches([])
        setLoadError('ブランチの読み込みに失敗しました。')
      }
    } catch (error) {
      if (!isCurrentRequest()) return

      setBranches([])
      setLoadError(error instanceof Error ? error.message : 'ブランチの読み込みに失敗しました。')
    } finally {
      if (isCurrentRequest()) {
        setBranchesLoading(false)
      }
    }
  }, [repoPath])

  useEffect(() => {
    if (!open) {
      branchLoadRequestId.current += 1
      setIsCreatingMode(false)
      setNewBranchName('')
      setBranchSearch('')
      setLoadError(null)
      setBranchesLoading(false)
      return
    }
    void loadBranches()

    return () => {
      branchLoadRequestId.current += 1
    }
  }, [open, loadBranches])

  const localBranches = useMemo(() => branches.filter((branch) => !branch.isRemote), [branches])

  const filteredBranches = useMemo(() => {
    const query = branchSearch.trim().toLowerCase()
    return localBranches
      .filter((branch) => !query || branch.name.toLowerCase().includes(query))
      .sort((a, b) => {
        if (a.isCurrent) return -1
        if (b.isCurrent) return 1
        return a.name.localeCompare(b.name)
      })
  }, [localBranches, branchSearch])

  const emptyListMessage = useMemo((): string | null => {
    if (loadError || branchesLoading) return null
    if (localBranches.length === 0) return 'ブランチがまだありません。'
    if (branchSearch.trim()) return '検索条件に一致するブランチがありません。'
    return null
  }, [branchSearch, branchesLoading, loadError, localBranches.length])

  const canCreateBranch = !branchesLoading && !loadError

  const resolveCheckedOutBranch = (branch: BranchInfo): string => {
    if (!branch.isRemote) return branch.name
    const slash = branch.name.indexOf('/')
    return slash >= 0 ? branch.name.slice(slash + 1) : branch.name
  }

  const handleBranchChanged = (branchName: string): void => {
    updateProject(projectId, { gitBranch: branchName })
    if (activeTerminalId) {
      updateTerminalGitBranch(activeTerminalId, branchName)
    }
  }

  const handleCheckout = async (branch: BranchInfo): Promise<void> => {
    if (branch.isCurrent || branch.hasOtherWorktree || isSwitching) return

    setIsSwitching(true)
    try {
      await gitApi.checkoutBranch(repoPath, branch.name, branch.isRemote)
      const checkedOut = resolveCheckedOutBranch(branch)
      handleBranchChanged(checkedOut)
      toast.success(`${checkedOut} に切り替えました`)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ブランチの切り替えに失敗しました')
    } finally {
      setIsSwitching(false)
    }
  }

  const handleCreateBranch = async (): Promise<void> => {
    if (branchesLoading) {
      toast.error('ブランチの読み込みが完了するまでお待ちください')
      return
    }
    if (loadError) {
      toast.error('新しいブランチを作成するには、ブランチの読み込みが成功している必要があります')
      return
    }

    const sanitized = sanitizeBranchName(newBranchName.trim())
    if (!sanitized) {
      toast.error('有効なブランチ名を入力してください')
      return
    }

    setIsSwitching(true)
    try {
      await gitApi.createBranch(repoPath, sanitized)
      handleBranchChanged(sanitized)
      toast.success(`${sanitized} を作成してチェックアウトしました`)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ブランチの作成に失敗しました')
    } finally {
      setIsSwitching(false)
    }
  }

  const displayLabel = currentBranch ?? 'デタッチド'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={statusBarTriggerClass}
          aria-label="Git ブランチを切り替え"
          disabled={isSwitching}
        >
          <GitBranch size={14} className="mr-1.5" />
          <span>{displayLabel}</span>
          {(ahead > 0 || behind > 0) && (
            <span className="ml-2 flex items-center space-x-1.5 border-l border-white/20 pl-2">
              {ahead > 0 && <span>↑{ahead}</span>}
              {behind > 0 && <span>↓{behind}</span>}
            </span>
          )}
          <ChevronDown size={12} className="ml-1 opacity-80" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-0">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={branchSearch}
              onChange={(e) => setBranchSearch(e.target.value)}
              placeholder="ブランチを検索..."
              className="w-full bg-secondary border border-border rounded pl-7 pr-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto py-1">
          {branchesLoading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              ブランチを読み込み中...
            </div>
          ) : loadError ? (
            <div className="px-3 py-4 text-center space-y-2">
              <div className="flex items-start justify-center gap-1.5 text-xs text-destructive">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span className="text-left">{loadError}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadBranches()}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw size={12} />
                再試行
              </button>
            </div>
          ) : emptyListMessage ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              {emptyListMessage}
            </div>
          ) : (
            filteredBranches.map((branch) => (
              <button
                key={branch.name}
                type="button"
                onClick={() => void handleCheckout(branch)}
                disabled={branch.isCurrent || branch.hasOtherWorktree || isSwitching}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors',
                  branch.isCurrent
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  branch.hasOtherWorktree && 'opacity-50 cursor-not-allowed'
                )}
                title={
                  branch.hasOtherWorktree
                    ? 'このブランチは別の worktree でチェックアウトされています'
                    : undefined
                }
              >
                <GitBranch size={10} className="flex-shrink-0" />
                <span className="truncate flex-1">{branch.name}</span>
                {branch.isCurrent && (
                  <span className="text-[10px] text-muted-foreground">現在</span>
                )}
                {branch.hasOtherWorktree && (
                  <span className="text-[10px] text-muted-foreground">worktree</span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="border-t border-border p-2">
          {isCreatingMode ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateBranch()
                  if (e.key === 'Escape') setIsCreatingMode(false)
                }}
                placeholder="新しいブランチ名"
                className="flex-1 bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
                autoFocus
                disabled={isSwitching}
              />
              <button
                type="button"
                onClick={() => void handleCreateBranch()}
                disabled={isSwitching || !canCreateBranch || !newBranchName.trim()}
                className="text-xs px-2 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
              >
                作成
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreatingMode(true)}
              disabled={isSwitching || !canCreateBranch}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded transition-colors"
            >
              <Plus size={12} />
              新しいブランチを作成してチェックアウト...
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
