import type { DetectedShells } from '@shared/types/ipc.types'
import {
  ChevronDown,
  Info,
  KeySquare,
  Link2,
  Plus,
  RefreshCw,
  Save,
  Settings,
  ShieldAlert,
  TerminalSquare,
  Upload,
  X
} from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { NewProjectModal } from '@/components/NewProjectModal'
import {
  type SettingsCategory,
  SettingsLayout,
  SettingsSection
} from '@/components/settings/SettingsLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { dialogApi, filesystemApi, shellApi, worktreeApi } from '@/lib/api'
import { availableColors, getColorClasses } from '@/lib/colors'
import { mergeEnvVars, parseEnvFile } from '@/lib/env-parser'
import type { SettingsSearchEntry } from '@/lib/settings-search'
import { cn } from '@/lib/utils'
import { useActiveProject, useActiveProjectId, useProjectActions } from '@/stores/project-store'
import type { EnvVariable, ProjectColor } from '@/types/project'

const PROJECT_SETTINGS_CATEGORIES: SettingsCategory[] = [
  { id: 'general', label: '全般', icon: <Settings size={16} /> },
  { id: 'env-vars', label: '環境変数', icon: <KeySquare size={16} /> },
  { id: 'shell', label: 'シェル設定', icon: <TerminalSquare size={16} /> },
  { id: 'symlinks', label: 'ワークツリーのシンボリックリンク', icon: <Link2 size={16} /> },
  { id: 'emergency', label: '緊急モード', icon: <ShieldAlert size={16} /> }
]

const PROJECT_SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  {
    categoryId: 'general',
    label: 'プロジェクト名',
    description: 'プロジェクトの基本情報です。',
    keywords: ['rename', 'title', '名前', '名称変更']
  },
  {
    categoryId: 'general',
    label: 'ルートディレクトリ',
    description: 'ディスク上のプロジェクトの場所です。',
    keywords: ['path', 'folder', 'location', 'パス', 'フォルダ', '場所']
  },
  {
    categoryId: 'general',
    label: '色と見た目',
    description: 'プロジェクトの色と見た目です。',
    keywords: ['theme', 'color', '色', 'テーマ', '見た目']
  },
  {
    categoryId: 'env-vars',
    label: '環境変数',
    description: 'シェルセッションに渡すシークレットと設定です。',
    keywords: ['env', 'secrets', 'config', 'dotenv', '環境変数', '秘密情報', '設定']
  },
  {
    categoryId: 'shell',
    label: '既定のシェル',
    description: 'このワークスペースのターミナル環境をカスタマイズします。',
    keywords: ['bash', 'zsh', 'powershell', 'シェル', 'ワークスペース']
  },
  {
    categoryId: 'shell',
    label: '起動コマンド',
    description: '新しいターミナルセッション開始時に実行するコマンドです。',
    keywords: ['init', 'startup', 'command', '起動', 'コマンド']
  },
  {
    categoryId: 'symlinks',
    label: 'ワークツリーのシンボリックリンク',
    description: 'プロジェクトルートからワークツリーにシンボリックリンクするディレクトリです。',
    keywords: ['node_modules', 'gitignore', 'shared dependencies', 'シンボリックリンク', '共有']
  },
  {
    categoryId: 'emergency',
    label: '確認ダイアログをスキップ',
    description: 'ワークツリー操作中の不要な確認をスキップします。',
    keywords: ['emergency', 'confirm', '確認', 'スキップ']
  },
  {
    categoryId: 'emergency',
    label: '.gitignore選択をスキップ',
    description: 'ワークツリー作成時に既定のシンボリックリンク設定を使用します。',
    keywords: ['emergency', 'gitignore', 'スキップ']
  },
  {
    categoryId: 'emergency',
    label: '既定のブランチ接頭辞',
    description: '新規ブランチ名の接頭辞です。',
    keywords: ['branch', 'feature', 'hotfix', 'ブランチ', '接頭辞']
  }
]

export default function ProjectSettings() {
  const navigate = useNavigate()
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false)
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false)
  const activeProject = useActiveProject()
  const activeProjectId = useActiveProjectId()
  const { addProject, updateProject } = useProjectActions()

  const [projectName, setProjectName] = useState(activeProject?.name || '')
  const [selectedColor, setSelectedColor] = useState<ProjectColor>(activeProject?.color || 'blue')
  const [rootPath, setRootPath] = useState(activeProject?.path || '')
  const [envVars, setEnvVars] = useState<EnvVariable[]>(activeProject?.envVars || [])
  const [shell, setShell] = useState(activeProject?.defaultShell || '')
  const [hasChanges, setHasChanges] = useState(false)
  const [symlinkDirs, setSymlinkDirs] = useState<string[]>(activeProject?.symlinkDirs ?? [])
  const [symlinkLoading, setSymlinkLoading] = useState(false)
  const [availableShells, setAvailableShells] = useState<DetectedShells | null>(null)
  const [shellsLoading, setShellsLoading] = useState(true)
  const [importError, setImportError] = useState<string | null>(null)
  const [importWarnings, setImportWarnings] = useState<string | null>(null)
  // TODO: Persist these to app-settings-store (localStorage) for across-session retention
  const [skipConfirmations, setSkipConfirmations] = useState(false)
  const [skipGitignoreSelection, setSkipGitignoreSelection] = useState(false)
  const [defaultBranchPrefix, setDefaultBranchPrefix] = useState('feature/')

  // Platform-specific fallback shell
  const fallbackShell = navigator.platform.startsWith('Win') ? 'powershell' : 'bash'

  // Fetch available shells on mount
  useEffect(() => {
    const fetchShells = async () => {
      try {
        const result = await shellApi.getAvailableShells()
        if (result.success && result.data) {
          setAvailableShells(result.data)
        }
      } catch (err) {
        console.error('Failed to detect shells:', err)
        setAvailableShells(null)
      } finally {
        setShellsLoading(false)
      }
    }
    fetchShells()
  }, [])

  // Tracks which project's form fields have been initialized, so a late async
  // availableShells load (which re-runs the sync effect) cannot wipe fields the
  // user — or the D5 auto-fill — has since changed.
  const symlinkInitProjectRef = useRef<string | null>(null)
  const autoFilledSymlinkRef = useRef<string | null>(null)

  // Sync state when activeProject changes
  useEffect(() => {
    if (activeProject) {
      // setShell is intentionally outside the per-project guard: availableShells
      // resolves asynchronously after mount, and the resolved default must be
      // applied when it arrives.
      setShell(activeProject.defaultShell || availableShells?.default?.name || fallbackShell)
      // Everything else initializes once per project. The effect also re-runs when
      // availableShells resolves; without this guard that late run would wipe user
      // edits (and the D5 .gitignore auto-fill) made before shells loaded.
      if (symlinkInitProjectRef.current !== activeProject.id) {
        symlinkInitProjectRef.current = activeProject.id
        setProjectName(activeProject.name)
        setSelectedColor(activeProject.color)
        setRootPath(activeProject.path || '')
        setEnvVars(activeProject.envVars || [])
        setSymlinkDirs(activeProject.symlinkDirs ?? [])
        setHasChanges(false)
      }
    }
  }, [activeProject, availableShells?.default?.name, fallbackShell])

  // D5: default worktree symlinks ON. For a git project that has never configured
  // symlink dirs, pre-fill them from .gitignore so fresh worktrees inherit shared
  // deps (e.g. node_modules) and don't break with "module not found". Runs once per
  // project and never overwrites a list the user has already configured (non-empty).
  useEffect(() => {
    const proj = activeProject
    if (!proj?.path || !proj.isGitRepo) return
    if ((proj.symlinkDirs ?? []).length > 0) return
    if (autoFilledSymlinkRef.current === proj.id) return

    let cancelled = false
    const projId = proj.id
    const projPath = proj.path
    void (async () => {
      try {
        const result = await worktreeApi.parseGitignore(projPath)
        // Bail if the effect was cleaned up (project switched / unmounted). Cleanup
        // sets `cancelled`, so this is sufficient on its own.
        if (cancelled) return
        if (result.success && result.data) {
          const dirs = result.data.filter((d) => d.exists).map((d) => d.dirName)
          if (dirs.length > 0) {
            // Mark done only after a successful fill so a cancelled StrictMode
            // double-invoke doesn't suppress the real run.
            autoFilledSymlinkRef.current = projId
            setSymlinkDirs(dirs)
            setHasChanges(true)
          }
        }
      } catch {
        // Best-effort: leave the list empty if .gitignore can't be parsed.
      }
    })()
    return () => {
      cancelled = true
    }
    // Keyed on project identity only: this must run once per project selection and
    // not re-fire when other activeProject fields change (which would re-parse and
    // fight user edits).
  }, [activeProject?.id, activeProject?.path, activeProject?.isGitRepo, activeProject])

  const handleSave = () => {
    if (activeProject) {
      const normalizedEnvVars = envVars
        .map((envVar) => ({
          ...envVar,
          key: envVar.key.trim()
        }))
        .filter((envVar) => envVar.key !== '')

      // Normalize symlinkDirs: trim whitespace and remove empty/whitespace-only entries
      const normalizedSymlinkDirs = symlinkDirs.map((d) => d.trim()).filter((d) => d.length > 0)

      updateProject(activeProject.id, {
        name: projectName,
        color: selectedColor,
        path: rootPath,
        envVars: normalizedEnvVars,
        defaultShell: shell,
        symlinkDirs: normalizedSymlinkDirs
      })
      setEnvVars(normalizedEnvVars)
      setSymlinkDirs(normalizedSymlinkDirs)
      setHasChanges(false)
    }
  }

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
    setHasChanges(true)
  }

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  const addSymlinkDir = () => {
    setSymlinkDirs([...symlinkDirs, ''])
    setHasChanges(true)
  }

  const removeSymlinkDir = (index: number) => {
    setSymlinkDirs(symlinkDirs.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  const updateSymlinkDir = (index: number, value: string) => {
    const newDirs = [...symlinkDirs]
    newDirs[index] = value
    setSymlinkDirs(newDirs)
    setHasChanges(true)
  }

  const syncFromGitignore = async () => {
    if (!activeProject?.path) return
    setSymlinkLoading(true)
    try {
      const result = await worktreeApi.parseGitignore(activeProject.path)
      if (result.success && result.data) {
        const existing = new Set(symlinkDirs.filter((d) => d !== ''))
        const newDirs = result.data
          .filter((d) => d.exists && !existing.has(d.dirName))
          .map((d) => d.dirName)
        if (newDirs.length > 0) {
          // Merge: add new dirs that aren't already in the list
          setSymlinkDirs([...symlinkDirs.filter((d) => d !== ''), ...newDirs])
          setHasChanges(true)
        }
      }
    } catch {
      // Best-effort
    } finally {
      setSymlinkLoading(false)
    }
  }

  const handleImportEnvFile = async () => {
    // Capture the current project ID to detect concurrent project switches
    const projectIdAtStart = activeProjectId

    setImportError(null)
    setImportWarnings(null)

    const fileResult = await dialogApi.selectFile({
      filters: [{ name: '環境変数ファイル', extensions: ['env'] }],
      title: '.envファイルを選択'
    })

    // Check if project switched during dialog
    if (projectIdAtStart !== activeProjectId) {
      return
    }

    if (!fileResult.success) {
      // User cancelled - not an error
      return
    }

    const readResult = await filesystemApi.readFile(fileResult.data)

    // Check if project switched during file read
    if (projectIdAtStart !== activeProjectId) {
      return
    }

    if (!readResult.success) {
      setImportError(`ファイルの読み込みに失敗しました: ${readResult.error}`)
      return
    }

    const parseResult = parseEnvFile(readResult.data.content)

    if (parseResult.vars.length === 0 && parseResult.invalidLines.length === 0) {
      setImportError('.envファイルが空です。')
      return
    }

    // Merge with existing env vars using functional update to avoid stale state
    setEnvVars((prevEnvVars) => mergeEnvVars(prevEnvVars, parseResult.vars))
    setHasChanges(true)

    // Show warnings for invalid lines if any
    if (parseResult.invalidLines.length > 0) {
      const warningDetails = parseResult.invalidLines
        .slice(0, 3)
        .map((l) => `${l.line}行目: ${l.content}`)
        .join('\n')
      const moreCount =
        parseResult.invalidLines.length > 3 ? ` （他${parseResult.invalidLines.length - 3}件）` : ''
      setImportWarnings(
        `${parseResult.vars.length}件の変数を読み込みました。\n無効な行を${parseResult.invalidLines.length}件スキップしました:\n${warningDetails}${moreCount}`
      )
    }
  }

  return (
    <>
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-8 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded text-primary">
              <Settings size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground leading-tight">
                プロジェクト設定
              </h1>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-secondary-foreground">
                  {activeProject?.name}
                </span>{' '}
                の設定
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (hasChanges) {
                setIsCloseConfirmOpen(true)
              } else {
                navigate('/')
              }
            }}
            className="group flex items-center justify-center h-8 w-8 rounded-md hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="閉じる"
            aria-label="プロジェクト設定を閉じる"
          >
            <X size={18} className="text-muted-foreground group-hover:text-foreground" />
          </button>
        </div>

        {/* Content */}
        <SettingsLayout
          categories={PROJECT_SETTINGS_CATEGORIES}
          searchIndex={PROJECT_SETTINGS_SEARCH_INDEX}
        >
          {/* General Section */}
          <SettingsSection id="general">
            <div className="flex items-start gap-6 border-b border-border pb-6">
              <div className="w-1/3 pt-1">
                <h2 className="text-lg font-medium text-foreground">全般</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  プロジェクトの基本情報と場所です。
                </p>
              </div>
              <div className="w-2/3 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    プロジェクト名
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value)
                      setHasChanges(true)
                    }}
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    ルートディレクトリ
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={rootPath}
                      onChange={(e) => {
                        setRootPath(e.target.value)
                        setHasChanges(true)
                      }}
                      className="flex-1 bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground font-mono focus:ring-2 focus:ring-primary outline-none"
                    />
                    <button
                      onClick={async () => {
                        const result = await dialogApi.selectDirectory()
                        if (result.success) {
                          setRootPath(result.data)
                          setHasChanges(true)
                        }
                      }}
                      className="px-4 py-2 bg-card hover:bg-secondary border border-border rounded-md text-sm text-foreground transition-colors shadow-sm"
                    >
                      参照
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ルートディレクトリの変更は新しいターミナルにのみ反映されます。
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-3">
                    色と見た目
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {availableColors.map((color) => {
                      const colors = getColorClasses(color)
                      return (
                        <button
                          key={color}
                          onClick={() => {
                            setSelectedColor(color)
                            setHasChanges(true)
                          }}
                          className={cn(
                            'w-8 h-8 rounded-full transition-all',
                            colors.bg,
                            selectedColor === color
                              ? 'ring-2 ring-offset-2 ring-offset-background ring-current shadow-sm'
                              : 'border-2 border-transparent hover:opacity-80'
                          )}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* Environment Variables Section */}
          <SettingsSection id="env-vars">
            <div className="flex items-start gap-6 border-b border-border pb-6">
              <div className="w-1/3 pt-1">
                <h2 className="text-lg font-medium text-foreground">環境変数</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  シェルセッションに渡すシークレットと設定です。シークレットの値はセキュアストレージが
                  追加されるまでアプリ再起動時にクリアされます。
                </p>
                <button
                  onClick={addEnvVar}
                  className="mt-4 text-xs flex items-center text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Plus size={14} className="mr-1" /> 変数を追加
                </button>
                <button
                  onClick={handleImportEnvFile}
                  className="mt-2 text-xs flex items-center text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Upload size={14} className="mr-1" /> .envから読み込む
                </button>
                {importError && <p className="mt-2 text-xs text-destructive">{importError}</p>}
                {importWarnings && (
                  <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 whitespace-pre-line">
                    {importWarnings}
                  </p>
                )}
              </div>
              <div className="w-2/3">
                <div className="bg-secondary/30 rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[1fr_1.5fr_auto] gap-px bg-border">
                    <div className="label-section bg-secondary/80 px-4 py-2 text-muted-foreground">
                      キー
                    </div>
                    <div className="label-section bg-secondary/80 px-4 py-2 text-muted-foreground">
                      値
                    </div>
                    <div className="bg-secondary/80 w-10"></div>

                    {envVars.map((envVar, index) => (
                      <Fragment key={index}>
                        <div className="bg-card p-2">
                          <input
                            type="text"
                            value={envVar.key}
                            onChange={(e) => {
                              const newVars = [...envVars]
                              newVars[index].key = e.target.value
                              setEnvVars(newVars)
                              setHasChanges(true)
                            }}
                            placeholder="KEY"
                            className="w-full bg-transparent border-none text-sm font-mono text-primary focus:ring-0 px-2 py-1"
                          />
                        </div>
                        <div className="bg-card p-2 relative group">
                          <input
                            type={envVar.isSecret ? 'password' : 'text'}
                            value={envVar.value}
                            onChange={(e) => {
                              const newVars = [...envVars]
                              newVars[index].value = e.target.value
                              setEnvVars(newVars)
                              setHasChanges(true)
                            }}
                            placeholder="値"
                            className={cn(
                              'w-full bg-transparent border-none text-sm font-mono focus:ring-0 px-2 py-1',
                              envVar.isSecret ? 'text-muted-foreground' : 'text-green-400'
                            )}
                          />
                        </div>
                        <div className="bg-card flex items-center justify-center">
                          <button
                            onClick={() => removeEnvVar(index)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* Shell Settings Section */}
          <SettingsSection id="shell">
            <div className="flex items-start gap-6 border-b border-border pb-6">
              <div className="w-1/3 pt-1">
                <h2 className="text-lg font-medium text-foreground">シェル設定</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  このワークスペースのターミナル環境をカスタマイズします。
                </p>
              </div>
              <div className="w-2/3 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    既定のシェル
                  </label>
                  {shellsLoading ? (
                    <Skeleton className="w-full h-10" />
                  ) : (
                    <div className="relative">
                      <select
                        value={shell}
                        onChange={(e) => {
                          setShell(e.target.value)
                          setHasChanges(true)
                        }}
                        className="w-full appearance-none bg-secondary/50 border border-border rounded-md pl-3 pr-10 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer shadow-sm"
                      >
                        {availableShells?.available && availableShells.available.length > 0 ? (
                          availableShells.available.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.displayName}
                            </option>
                          ))
                        ) : (
                          <option value="">シェルが検出されませんでした</option>
                        )}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* Worktree Symlink Directories Section */}
          <SettingsSection id="symlinks">
            <div className="flex items-start gap-6 border-b border-border pb-6">
              <div className="w-1/3 pt-1">
                <h2 className="text-lg font-medium text-foreground">
                  ワークツリーのシンボリックリンク
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  プロジェクトルートからワークツリーへシンボリックリンクするディレクトリです。これにより
                  <code className="text-xs bg-secondary/50 px-1 rounded">node_modules</code>
                  などの共有依存関係を、再インストールせずにワークツリー間で使えます。
                </p>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => void syncFromGitignore()}
                    disabled={symlinkLoading || !activeProject?.isGitRepo}
                    className="text-xs flex items-center text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw
                      size={14}
                      className={`mr-1 ${symlinkLoading ? 'animate-spin' : ''}`}
                    />
                    .gitignoreから同期
                  </button>
                  <button
                    onClick={addSymlinkDir}
                    className="text-xs flex items-center text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    <Plus size={14} className="mr-1" /> ディレクトリを追加
                  </button>
                </div>
              </div>
              <div className="w-2/3">
                <div className="bg-secondary/30 rounded-lg border border-border p-3 space-y-2">
                  {symlinkDirs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      シンボリックリンクのディレクトリが設定されていません。「.gitignoreから同期」を
                      クリックすると自動検出します。
                    </p>
                  ) : (
                    symlinkDirs.map((dir, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Link2 size={12} className="text-muted-foreground flex-shrink-0" />
                        <input
                          type="text"
                          value={dir}
                          onChange={(e) => updateSymlinkDir(index, e.target.value)}
                          placeholder="例: node_modules"
                          className="flex-1 bg-secondary/50 border border-border rounded px-2 py-1 text-sm font-mono text-foreground focus:ring-1 focus:ring-primary outline-none placeholder-muted-foreground"
                        />
                        <button
                          onClick={() => removeSymlinkDir(index)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* Emergency Mode & Expert Workflows Section */}
          <SettingsSection id="emergency">
            <div className="flex items-start gap-6">
              <div className="w-1/3 pt-1">
                <h2 className="text-lg font-medium text-foreground">緊急モード</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  インシデント対応や素早いワークツリー操作のためのパワーユーザー向けワークフロー設定です。
                </p>
              </div>
              <div className="w-2/3">
                <div className="bg-secondary/30 rounded-lg border border-border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        確認ダイアログをスキップ
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ワークツリー操作中の不要な確認をスキップします。
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={skipConfirmations}
                        onChange={(e) => {
                          setSkipConfirmations(e.target.checked)
                        }}
                      />
                      <div className="w-9 h-5 bg-secondary rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-popover after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        .gitignore選択をスキップ
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ワークツリー作成時に既定のシンボリックリンク設定を使用します。
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={skipGitignoreSelection}
                        onChange={(e) => {
                          setSkipGitignoreSelection(e.target.checked)
                        }}
                      />
                      <div className="w-9 h-5 bg-secondary rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-popover after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      既定のブランチ接頭辞
                    </label>
                    <input
                      type="text"
                      value={defaultBranchPrefix}
                      onChange={(e) => {
                        setDefaultBranchPrefix(e.target.value)
                      }}
                      placeholder="feature/"
                      className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      新規ブランチ名の接頭辞です（例:「feature/」「hotfix/」）。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SettingsSection>
        </SettingsLayout>

        {/* Save Bar */}
        {hasChanges && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t border-border flex justify-end items-center gap-4 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <span className="text-sm text-muted-foreground mr-auto flex items-center">
              <Info size={14} className="mr-2 text-yellow-500" />
              <span className="opacity-80">保存されていない変更があります</span>
            </span>
            <button
              onClick={() => setHasChanges(false)}
              className="px-4 py-2 text-sm font-medium text-secondary-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
            >
              破棄
            </button>
            <button
              onClick={handleSave}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2 px-6 rounded shadow-lg shadow-primary/20 transition-all flex items-center"
            >
              <Save size={14} className="mr-2" />
              変更を保存
            </button>
          </div>
        )}
      </main>

      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreateProject={addProject}
      />

      <ConfirmDialog
        isOpen={isCloseConfirmOpen}
        title="保存されていない変更"
        message={`${activeProject?.name ?? 'このプロジェクト'} に保存されていない変更があります。移動すると変更内容は破棄されます。`}
        confirmLabel="移動する"
        cancelLabel="キャンセル"
        variant="danger"
        onConfirm={() => {
          setIsCloseConfirmOpen(false)
          navigate('/')
        }}
        onCancel={() => setIsCloseConfirmOpen(false)}
      />
    </>
  )
}
