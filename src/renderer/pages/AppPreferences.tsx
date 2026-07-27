import type { DetectedShells } from '@shared/types/ipc.types'
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Keyboard,
  Monitor,
  Palette,
  RotateCcw,
  Sliders,
  Terminal,
  X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ShortcutRecorder } from '@/components/ShortcutRecorder'
import { AcpAgentsSettings } from '@/components/settings/AcpAgentsSettings'
import {
  type SettingsCategory,
  SettingsLayout,
  SettingsSection
} from '@/components/settings/SettingsLayout'
import { useResetAppSettings, useUpdateAppSetting } from '@/hooks/use-app-settings'
import {
  useResetAllShortcuts,
  useResetShortcut,
  useUpdateShortcut
} from '@/hooks/use-keyboard-shortcuts'
import { logApi, shellApi, terminalApi } from '@/lib/api'
import { availableColors, getColorClasses } from '@/lib/colors'
import type { SettingsSearchEntry } from '@/lib/settings-search'
import { isAurUpdateMode } from '@/lib/tauri-updater-api'
import { cn } from '@/lib/utils'
import {
  useConfirmTerminalClose,
  useDefaultProjectColor,
  useDefaultShell,
  useMaxTerminalsPerProject,
  useOrphanDetectionEnabled,
  useOrphanDetectionTimeout,
  useTerminalBufferSize,
  useTerminalFontFamily,
  useTerminalFontSize,
  useTerminalRenderer,
  useTerminalUrlOpenMode,
  useUiZoomLevel
} from '@/stores/app-settings-store'
import { useKeyboardShortcutsStore } from '@/stores/keyboard-shortcuts-store'
import { useUpdaterActions, useUpdaterState } from '@/stores/updater-store'
import type { ProjectColor } from '@/types/project'
import {
  BUFFER_SIZE_OPTIONS,
  FONT_FAMILY_OPTIONS,
  MAX_TERMINALS_OPTIONS,
  ORPHAN_TIMEOUT_OPTIONS,
  TERMINAL_RENDERER_OPTIONS,
  TERMINAL_URL_OPEN_MODE_OPTIONS,
  type TerminalUrlOpenMode,
  UI_ZOOM_DEFAULT,
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
  UI_ZOOM_STEP
} from '@/types/settings'

const APP_PREF_CATEGORIES: SettingsCategory[] = [
  { id: 'appearance', label: 'ターミナルの見た目', icon: <Palette size={16} /> },
  { id: 'shell', label: '既定のシェル', icon: <Terminal size={16} /> },
  { id: 'behavior', label: 'ターミナルの動作', icon: <Sliders size={16} /> },
  { id: 'project-defaults', label: '新規プロジェクトの既定値', icon: <Monitor size={16} /> },
  { id: 'ai-agents', label: 'AIエージェント', icon: <Bot size={16} /> },
  { id: 'shortcuts', label: 'キーボードショートカット', icon: <Keyboard size={16} /> },
  { id: 'updates', label: 'アップデート', icon: <Download size={16} /> },
  { id: 'diagnostics', label: '診断とログ', icon: <FileText size={16} /> },
  { id: 'reset', label: '設定のリセット', icon: <RotateCcw size={16} /> }
]

const APP_PREF_SEARCH_INDEX: SettingsSearchEntry[] = [
  {
    categoryId: 'appearance',
    label: 'フォントファミリー',
    description: 'ターミナルのテキストに使う等幅フォントを選択します。',
    keywords: ['typeface', 'monospace', 'フォント', '書体', '等幅フォント']
  },
  {
    categoryId: 'appearance',
    label: 'フォントサイズ',
    description: 'ターミナルのテキストサイズを調整します。',
    keywords: ['text size', 'zoom', 'フォントサイズ', '文字サイズ']
  },
  {
    categoryId: 'appearance',
    label: 'UIズームレベル',
    description: '画面全体を50〜300%の範囲で拡大縮小します。',
    keywords: [
      'ui zoom',
      'zoom',
      'interface scale',
      'window zoom',
      'magnify',
      'ズーム',
      '拡大縮小',
      '画面拡大'
    ]
  },
  {
    categoryId: 'appearance',
    label: 'スクロールバックのバッファサイズ',
    description: 'ターミナルの履歴として保持する行数です。',
    keywords: ['history', 'lines', 'memory', '履歴', '行数', 'バッファ']
  },
  {
    categoryId: 'appearance',
    label: 'プロジェクトあたりの最大ターミナル数',
    description: '1つのプロジェクトで開けるターミナルタブの最大数です。',
    keywords: ['tabs', 'limit', 'タブ', '上限', '最大数']
  },
  {
    categoryId: 'appearance',
    label: 'ターミナルレンダラー',
    description: 'ターミナル出力のGPUアクセラレーション描画です。',
    keywords: ['webgl', 'dom', 'gpu', 'レンダラー', '描画']
  },
  {
    categoryId: 'shell',
    label: '既定のシェル',
    description: '新しいターミナルで使う既定のシェルを設定します。',
    keywords: ['bash', 'zsh', 'powershell', 'fish', 'シェル', '既定']
  },
  {
    categoryId: 'behavior',
    label: 'ターミナルのリンクを開く方法',
    description: 'ターミナル出力内のURLの開き方を選択します。',
    keywords: ['url', 'links', 'browser', 'リンク', 'ブラウザ']
  },
  {
    categoryId: 'behavior',
    label: 'オーファン検出',
    description: '非アクティブなターミナルを自動的に片付けます。',
    keywords: ['cleanup', 'inactive', 'timeout', '自動終了', '非アクティブ', 'クリーンアップ']
  },
  {
    categoryId: 'behavior',
    label: '片付けまでのタイムアウト',
    description: '非アクティブなターミナルが片付けられるまでの時間です。',
    keywords: ['orphan', 'inactive', 'タイムアウト', '時間']
  },
  {
    categoryId: 'project-defaults',
    label: '既定の色',
    description: '新規プロジェクトはこの色を既定で使用します。',
    keywords: ['theme', 'appearance', '色', 'テーマ']
  },
  {
    categoryId: 'ai-agents',
    label: 'AIエージェント',
    description: 'レジストリからACPコーディングエージェントを有効化します。',
    keywords: ['acp', 'agent', 'coding assistant', 'エージェント', 'コーディング支援']
  },
  {
    categoryId: 'shortcuts',
    label: 'キーボードショートカット',
    description: '作業スタイルに合わせてキーボードショートカットをカスタマイズします。',
    keywords: ['hotkeys', 'bindings', 'keybindings', 'ショートカット', 'キー割り当て']
  },
  {
    categoryId: 'updates',
    label: 'アップデートを確認',
    description: 'アプリケーションのアップデートとバージョン情報を管理します。',
    keywords: ['version', 'upgrade', 'アップデート', 'バージョン']
  },
  {
    categoryId: 'updates',
    label: '自動アップデート',
    description: 'アップデートを自動的に確認します。',
    keywords: ['automatic', 'version', '自動更新', '自動確認']
  },
  {
    categoryId: 'diagnostics',
    label: '診断とログ',
    description: '問題解決のためにアプリケーションログを書き出し・コピーします。',
    keywords: ['logs', 'export', 'troubleshoot', 'debug', 'ログ', '書き出し', '不具合調査']
  },
  {
    categoryId: 'reset',
    label: '設定のリセット',
    description: 'すべての設定を既定値に戻します。',
    keywords: ['restore', 'defaults', 'clear', 'リセット', '初期化', '既定値']
  }
]

export default function AppPreferences(): React.JSX.Element {
  const navigate = useNavigate()
  const isAurUpdater = isAurUpdateMode()
  const fontFamily = useTerminalFontFamily()
  const fontSize = useTerminalFontSize()
  const uiZoomLevel = useUiZoomLevel()
  const bufferSize = useTerminalBufferSize()
  const terminalRenderer = useTerminalRenderer()
  const defaultShell = useDefaultShell()
  const defaultProjectColor = useDefaultProjectColor() as ProjectColor
  const maxTerminals = useMaxTerminalsPerProject()
  const orphanDetectionEnabled = useOrphanDetectionEnabled()
  const orphanDetectionTimeout = useOrphanDetectionTimeout()
  const _confirmTerminalClose = useConfirmTerminalClose()
  const terminalUrlOpenMode = useTerminalUrlOpenMode()
  const updateSetting = useUpdateAppSetting()
  const resetSettings = useResetAppSettings()

  const [availableShells, setAvailableShells] = useState<DetectedShells | null>(null)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isResetShortcutsDialogOpen, setIsResetShortcutsDialogOpen] = useState(false)

  // Keyboard shortcuts
  const shortcuts = useKeyboardShortcutsStore((state) => state.shortcuts)
  const updateShortcut = useUpdateShortcut()
  const resetShortcut = useResetShortcut()
  const resetAllShortcuts = useResetAllShortcuts()

  // Updater state
  const {
    isChecking,
    updateAvailable,
    version,
    lastChecked,
    autoUpdateEnabled,
    skippedVersion,
    error: updateError,
    isManualUpdateMode
  } = useUpdaterState()
  const { checkForUpdates, installAndRestart, setAutoUpdateEnabled } = useUpdaterActions()

  // Load available shells
  useEffect(() => {
    async function loadShells(): Promise<void> {
      try {
        const result = await shellApi.getAvailableShells()
        if (result.success && result.data) {
          setAvailableShells(result.data)
        }
      } catch {
        // Silently fail - user will see empty dropdown with System Default option
      }
    }
    void loadShells()
  }, [])

  const handleFontFamilyChange = (value: string) => {
    updateSetting('terminalFontFamily', value)
  }

  const handleFontSizeChange = (value: number) => {
    updateSetting('terminalFontSize', value)
  }

  const handleUiZoomChange = (value: number) => {
    updateSetting('uiZoomLevel', value)
  }

  const handleUiZoomReset = () => {
    updateSetting('uiZoomLevel', UI_ZOOM_DEFAULT)
  }

  const handleBufferSizeChange = (value: number) => {
    updateSetting('terminalBufferSize', value)
  }

  const handleRendererChange = (value: string) => {
    if (value === 'auto' || value === 'webgl' || value === 'dom') {
      updateSetting('terminalRenderer', value)
    }
  }

  const handleDefaultShellChange = (value: string) => {
    updateSetting('defaultShell', value)
  }

  const handleDefaultProjectColorChange = (value: ProjectColor) => {
    updateSetting('defaultProjectColor', value)
  }

  const handleMaxTerminalsChange = (value: number) => {
    updateSetting('maxTerminalsPerProject', value)
  }

  const isTerminalUrlOpenMode = (value: string): value is TerminalUrlOpenMode =>
    TERMINAL_URL_OPEN_MODE_OPTIONS.some((option) => option.value === value)

  const handleTerminalUrlOpenModeChange = (value: string) => {
    if (!isTerminalUrlOpenMode(value)) {
      return
    }

    updateSetting('terminalUrlOpenMode', value)
  }

  const _handleConfirmTerminalCloseToggle = async (enabled: boolean) => {
    await updateSetting('confirmTerminalClose', enabled)
  }

  const handleOrphanDetectionToggle = async (enabled: boolean) => {
    await updateSetting('orphanDetectionEnabled', enabled)
    // Apply to PtyManager immediately
    try {
      await terminalApi.updateOrphanDetection(enabled, orphanDetectionTimeout)
    } catch (error) {
      console.error('Failed to update orphan detection:', error)
    }
  }

  const handleOrphanTimeoutChange = async (value: number | null) => {
    await updateSetting('orphanDetectionTimeout', value)
    // Apply to PtyManager immediately
    try {
      await terminalApi.updateOrphanDetection(orphanDetectionEnabled, value)
    } catch (error) {
      console.error('Failed to update orphan detection timeout:', error)
    }
  }

  const handleResetConfirm = async () => {
    await resetSettings()
    await resetAllShortcuts()
    setIsResetDialogOpen(false)
  }

  const handleResetShortcutsConfirm = async () => {
    await resetAllShortcuts()
    setIsResetShortcutsDialogOpen(false)
  }

  const handleAutoUpdateToggle = async (enabled: boolean) => {
    await setAutoUpdateEnabled(enabled)
  }

  const formatLastChecked = (date: Date | null): string => {
    if (!date) return '未確認'
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date)
  }

  return (
    <>
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-8 border-b border-border bg-card flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-foreground leading-tight">
              アプリケーション環境設定
            </h1>
            <p className="text-xs text-muted-foreground">アプリケーション全体の設定を行います</p>
          </div>
          <button
            onClick={() => {
              navigate('/')
            }}
            className="group flex items-center justify-center h-8 w-8 rounded-md hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="閉じる"
            aria-label="環境設定を閉じる"
          >
            <X size={18} className="text-muted-foreground group-hover:text-foreground" />
          </button>
        </div>

        {/* Content */}
        <SettingsLayout categories={APP_PREF_CATEGORIES} searchIndex={APP_PREF_SEARCH_INDEX}>
          {/* Terminal Appearance Section */}
          <SettingsSection id="appearance">
            <div className="flex items-start gap-6 border-b border-border pb-6">
              <div className="w-1/3 pt-1">
                <h2 className="text-lg font-medium text-foreground">ターミナルの見た目</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  ターミナルの見た目や質感をカスタマイズします。
                </p>
              </div>
              <div className="w-2/3 space-y-4">
                {/* UI Zoom Level (whole interface) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-secondary-foreground">
                      UIズームレベル
                    </label>
                    <button
                      type="button"
                      onClick={handleUiZoomReset}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                      disabled={uiZoomLevel === UI_ZOOM_DEFAULT}
                    >
                      100%に戻す
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={UI_ZOOM_MIN}
                      max={UI_ZOOM_MAX}
                      step={UI_ZOOM_STEP}
                      value={uiZoomLevel}
                      onChange={(e) => handleUiZoomChange(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-sm text-muted-foreground w-14 text-right">
                      {Math.round(uiZoomLevel * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    画面全体を50〜300%の範囲で拡大縮小します。Ctrl+=、Ctrl+-、Ctrl+0でも調整できます。
                  </p>
                </div>

                {/* Font Family */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    フォントファミリー
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => handleFontFamilyChange(e.target.value)}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                  >
                    {FONT_FAMILY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    ターミナルのテキストに使う等幅フォントを選択します。
                  </p>
                </div>

                {/* Font Size */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    フォントサイズ: {fontSize}px
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={10}
                      max={24}
                      value={fontSize}
                      onChange={(e) => handleFontSizeChange(parseInt(e.target.value, 10))}
                      className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {fontSize}px
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ターミナルのテキストサイズを調整します（10〜24px）。
                  </p>
                </div>

                {/* Buffer Size */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    スクロールバックのバッファサイズ
                  </label>
                  <select
                    value={bufferSize}
                    onChange={(e) => handleBufferSizeChange(parseInt(e.target.value, 10))}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                  >
                    {BUFFER_SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    ターミナルの履歴として保持する行数です。値が大きいほどメモリを多く使用します。
                    変更は新しいターミナルに適用されます。
                  </p>
                </div>

                {/* Max Terminals */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    プロジェクトあたりの最大ターミナル数
                  </label>
                  <select
                    value={maxTerminals}
                    onChange={(e) => handleMaxTerminalsChange(parseInt(e.target.value, 10))}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                  >
                    {MAX_TERMINALS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    1つのプロジェクトで開けるターミナルタブの最大数です。
                  </p>
                </div>

                {/* Terminal Renderer */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    ターミナルレンダラー
                  </label>
                  <select
                    value={terminalRenderer}
                    onChange={(e) => handleRendererChange(e.target.value)}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                  >
                    {TERMINAL_RENDERER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    ターミナル出力のGPUアクセラレーション描画です。WebGLが最も高いパフォーマンスを発揮します。
                    変更は新しいターミナルに適用されます。
                  </p>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    プレビュー
                  </label>
                  <div
                    className="bg-terminal-bg border border-border rounded-md p-4 text-terminal-fg"
                    style={{
                      fontFamily: fontFamily,
                      fontSize: `${fontSize}px`,
                      lineHeight: 1.2
                    }}
                  >
                    <div>$ echo "Hello, World!"</div>
                    <div>Hello, World!</div>
                    <div>$ ls -la</div>
                    <div>drwxr-xr-x 5 user staff 160 Jan 11 10:00 .</div>
                  </div>
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* Default Shell Section */}
          <SettingsSection id="shell">
            <div className="flex items-start gap-6 border-b border-border pb-6">
              <div className="w-1/3 pt-1">
                <h2 className="text-lg font-medium text-foreground">既定のシェル</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  新しいターミナルで使う既定のシェルを設定します。
                </p>
              </div>
              <div className="w-2/3 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    シェル
                  </label>
                  <select
                    value={(() => {
                      // Normalize the stored defaultShell for display
                      // If it's a path, use it directly; if it's a name, find matching shell's path
                      if (!defaultShell) return ''
                      if (defaultShell.includes('\\') || defaultShell.includes('/')) {
                        return defaultShell
                      }
                      // Find shell by name or by basename of path
                      const match = availableShells?.available.find((s) => {
                        if (s.name === defaultShell) return true
                        const pathBasename = s.path.split(/[\\/]/).pop()
                        return pathBasename === defaultShell
                      })
                      return match?.path ?? defaultShell
                    })()}
                    onChange={(e) => handleDefaultShellChange(e.target.value)}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                  >
                    <option value="">システムの既定値</option>
                    {availableShells?.available?.map((shell) => (
                      <option key={shell.path} value={shell.path}>
                        {shell.displayName}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    プロジェクト設定で個別に上書きできます。
                  </p>
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* Terminal Behavior Section */}
          <SettingsSection id="behavior">
            <div className="flex items-start gap-6 border-b border-border pb-6">
              <div className="w-1/3 pt-1">
                <h2 className="text-lg font-medium text-foreground">ターミナルの動作</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  非アクティブなターミナルの管理方法を設定します。
                </p>
              </div>
              <div className="w-2/3 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    ターミナルのリンクを開く方法
                  </label>
                  <select
                    value={terminalUrlOpenMode}
                    onChange={(e) => handleTerminalUrlOpenModeChange(e.target.value)}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                  >
                    {TERMINAL_URL_OPEN_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    ターミナル出力内のURLをCtrl/Cmd+クリックした際に、システムのブラウザで開くか
                    Termulの新しいブラウザタブで開くかを選択します。
                  </p>
                </div>

                {/* Orphan Detection Toggle */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    オーファン検出
                  </label>
                  <div className="flex items-center justify-between bg-secondary/30 border border-border rounded-md px-4 py-3">
                    <div className="flex-1">
                      <div className="text-sm text-foreground">オーファン検出を有効にする</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        非アクティブなターミナルを自動的に片付けます
                      </div>
                    </div>
                    <button
                      onClick={() => handleOrphanDetectionToggle(!orphanDetectionEnabled)}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                        orphanDetectionEnabled ? 'bg-primary' : 'bg-input'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          orphanDetectionEnabled ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Timeout Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    片付けまでのタイムアウト
                  </label>
                  <select
                    value={orphanDetectionTimeout ?? 600000}
                    onChange={(e) =>
                      handleOrphanTimeoutChange(
                        e.target.value ? parseInt(e.target.value, 10) : null
                      )
                    }
                    disabled={!orphanDetectionEnabled}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {ORPHAN_TIMEOUT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    この時間だけ非アクティブなターミナルは片付けられます（表示されていない場合のみ）。
                  </p>
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* New Project Defaults Section */}
          <SettingsSection id="project-defaults">
            <div className="flex items-start gap-6 border-b border-border pb-6">
              <div className="w-1/3 pt-1">
                <h2 className="text-lg font-medium text-foreground">新規プロジェクトの既定値</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  新規プロジェクトの既定オプションを設定します。
                </p>
              </div>
              <div className="w-2/3 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    既定の色
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {availableColors.map((color) => {
                      const colors = getColorClasses(color)
                      return (
                        <button
                          key={color}
                          onClick={() => handleDefaultProjectColorChange(color)}
                          className={cn(
                            'w-8 h-8 rounded-full transition-all',
                            colors.bg,
                            defaultProjectColor === color
                              ? 'ring-2 ring-offset-2 ring-offset-background ring-current'
                              : 'hover:opacity-80'
                          )}
                          title={color.charAt(0).toUpperCase() + color.slice(1)}
                        />
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    新規プロジェクトはこの色を既定で使用します。
                  </p>
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* AI Agents Section */}
          <SettingsSection id="ai-agents">
            <div className="flex items-start gap-6 border-b border-border pb-6">
              <div className="w-1/3 pt-1">
                <div className="flex items-center gap-2">
                  <Bot size={18} className="text-primary" />
                  <h2 className="text-lg font-medium text-foreground">AIエージェント</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  レジストリからACPコーディングエージェントを有効化します。有効にするとバックグラウンドで
                  ウォームアップされ、チャットがすぐに開始できます。
                </p>
              </div>
              <div className="w-2/3">
                <AcpAgentsSettings />
              </div>
            </div>
          </SettingsSection>

          {/* Keyboard Shortcuts Section */}
          <SettingsSection id="shortcuts">
            <div className="flex items-start gap-6 border-b border-border pb-6">
              <div className="w-1/3 pt-1">
                <div className="flex items-center gap-2">
                  <Keyboard size={18} className="text-primary" />
                  <h2 className="text-lg font-medium text-foreground">キーボードショートカット</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  作業スタイルに合わせてキーボードショートカットをカスタマイズします。
                </p>
                <button
                  onClick={() => setIsResetShortcutsDialogOpen(true)}
                  className="mt-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw size={12} />
                  すべてのショートカットをリセット
                </button>
              </div>
              <div className="w-2/3 space-y-4">
                {Object.values(shortcuts).map((shortcut) => (
                  <ShortcutRecorder
                    key={shortcut.id}
                    shortcut={shortcut}
                    allShortcuts={shortcuts}
                    onUpdate={updateShortcut}
                    onReset={resetShortcut}
                  />
                ))}
              </div>
            </div>
          </SettingsSection>

          {/* Updates Section */}
          <SettingsSection id="updates">
            <div className="flex items-start gap-6 border-b border-border pb-6">
              <div className="w-1/3 pt-1">
                <div className="flex items-center gap-2">
                  <Download size={18} className="text-primary" />
                  <h2 className="text-lg font-medium text-foreground">アップデート</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  アプリケーションのアップデートとバージョン情報を管理します。
                </p>
              </div>
              <div className="w-2/3 space-y-4">
                {/* Current Version */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    現在のバージョン
                  </label>
                  <div className="bg-secondary/30 border border-border rounded-md px-4 py-3">
                    <span className="text-sm font-mono text-foreground">
                      v{import.meta.env.PACKAGE_VERSION || '0.1.0'}
                    </span>
                  </div>
                </div>

                {/* Update Status */}
                {updateAvailable && version && (
                  <div>
                    <label className="block text-sm font-medium text-secondary-foreground mb-2">
                      利用可能なアップデート
                    </label>
                    <div
                      className={cn(
                        'border rounded-md px-4 py-3 flex items-center gap-3',
                        isManualUpdateMode
                          ? 'bg-amber-500/10 border-amber-500/20'
                          : 'bg-green-500/10 border-green-500/20'
                      )}
                    >
                      <CheckCircle2
                        size={18}
                        className={cn(
                          'flex-shrink-0',
                          isManualUpdateMode ? 'text-amber-500' : 'text-green-500'
                        )}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">
                          バージョン {version} が利用可能です！
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {isAurUpdater
                            ? 'AUR経由でアップデートしてください: yay -S termul-manager'
                            : isManualUpdateMode
                              ? '自動アップデートは利用できません。最新版を手動でダウンロードしてインストールしてください。'
                              : '新しいバージョンをダウンロードできます。'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Update Error */}
                {updateError && (
                  <div>
                    <label className="block text-sm font-medium text-secondary-foreground mb-2">
                      アップデートエラー
                    </label>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 flex items-center gap-3">
                      <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm text-foreground">{updateError}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Check for Updates Button */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    アップデートを確認
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={checkForUpdates}
                      disabled={isChecking}
                      className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed border border-primary rounded-lg text-sm text-primary-foreground transition-colors"
                    >
                      <Download size={16} />
                      {isChecking ? '確認中…' : 'アップデートを確認'}
                    </button>
                    {updateAvailable && isManualUpdateMode && (
                      <button
                        onClick={installAndRestart}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-500/90 border border-amber-500 rounded-lg text-sm text-white transition-colors"
                      >
                        <ExternalLink size={16} />
                        ダウンロードページを開く
                      </button>
                    )}
                  </div>
                  {lastChecked && (
                    <p className="text-xs text-muted-foreground mt-1">
                      最終確認: {formatLastChecked(lastChecked)}
                    </p>
                  )}
                </div>

                {/* Auto-update Toggle */}
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-2">
                    自動アップデート
                  </label>
                  <div className="flex items-center justify-between bg-secondary/30 border border-border rounded-md px-4 py-3">
                    <div className="flex-1">
                      <div className="text-sm text-foreground">
                        アップデートを自動的に確認します
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        有効にすると、アプリが定期的に新しいバージョンを確認します
                      </div>
                    </div>
                    <button
                      onClick={() => handleAutoUpdateToggle(!autoUpdateEnabled)}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                        autoUpdateEnabled ? 'bg-primary' : 'bg-input'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          autoUpdateEnabled ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Skipped Version */}
                {skippedVersion && (
                  <div>
                    <label className="block text-sm font-medium text-secondary-foreground mb-2">
                      スキップ中のバージョン
                    </label>
                    <div className="bg-secondary/30 border border-border rounded-md px-4 py-3">
                      <div className="text-sm text-foreground">
                        現在スキップ中のバージョン:{' '}
                        <span className="font-mono">{skippedVersion}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        このバージョンは、より新しいバージョンが利用可能になるまで再度案内されません。
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection id="diagnostics">
            <div className="flex items-start gap-6 border-b border-border pb-6">
              <div className="w-1/3 pt-1">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-primary" />
                  <h2 className="text-lg font-medium text-foreground">診断とログ</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  問題解決のためにアプリケーションログを書き出し・コピーします。
                </p>
              </div>
              <div className="w-2/3 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => void logApi.revealLogDir()}
                    className="flex items-center justify-start gap-2.5 px-4 py-3 bg-secondary/30 hover:bg-secondary/60 border border-border rounded-lg text-sm font-medium text-foreground transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm"
                  >
                    <FolderOpen size={16} className="text-muted-foreground" />
                    <div className="text-left">
                      <div>ログフォルダを開く</div>
                      <div className="text-3xs text-muted-foreground font-normal">
                        ファイルエクスプローラーで開きます
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void logApi.exportLogFile()}
                    className="flex items-center justify-start gap-2.5 px-4 py-3 bg-secondary/30 hover:bg-secondary/60 border border-border rounded-lg text-sm font-medium text-foreground transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm"
                  >
                    <FileText size={16} className="text-muted-foreground" />
                    <div className="text-left">
                      <div>ログファイルを書き出す…</div>
                      <div className="text-3xs text-muted-foreground font-normal">
                        任意の場所に保存します
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void logApi.copyLogContents()}
                    className="flex items-center justify-start gap-2.5 px-4 py-3 bg-secondary/30 hover:bg-secondary/60 border border-border rounded-lg text-sm font-medium text-foreground transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm"
                  >
                    <Clipboard size={16} className="text-muted-foreground" />
                    <div className="text-left">
                      <div>ログ内容をコピー</div>
                      <div className="text-3xs text-muted-foreground font-normal">
                        ログをクリップボードにコピーします
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void logApi.exportLogToDefault()}
                    className="flex items-center justify-start gap-2.5 px-4 py-3 bg-secondary/30 hover:bg-secondary/60 border border-border rounded-lg text-sm font-medium text-foreground transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm"
                  >
                    <Download size={16} className="text-muted-foreground" />
                    <div className="text-left">
                      <div>既定のフォルダに書き出す</div>
                      <div className="text-3xs text-muted-foreground font-normal">
                        ダウンロードフォルダに直接保存します
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* Reset Section */}
          <SettingsSection id="reset">
            <div className="flex items-start gap-6 pb-6">
              <div className="w-1/3 pt-1">
                <h2 className="text-lg font-medium text-foreground">設定のリセット</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  すべての設定を既定値に戻します。
                </p>
              </div>
              <div className="w-2/3">
                <button
                  onClick={() => setIsResetDialogOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-secondary border border-border rounded-lg text-sm text-foreground transition-colors"
                >
                  <RotateCcw size={16} />
                  既定値に戻す
                </button>
              </div>
            </div>
          </SettingsSection>
        </SettingsLayout>
      </main>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isResetDialogOpen}
        title="設定のリセット"
        message="すべてのアプリケーション設定を既定値に戻しますか？この操作は取り消せません。"
        confirmLabel="リセット"
        cancelLabel="キャンセル"
        variant="danger"
        onConfirm={handleResetConfirm}
        onCancel={() => setIsResetDialogOpen(false)}
      />

      {/* Reset Shortcuts Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isResetShortcutsDialogOpen}
        title="キーボードショートカットのリセット"
        message="すべてのキーボードショートカットを既定値に戻しますか？"
        confirmLabel="リセット"
        cancelLabel="キャンセル"
        variant="danger"
        onConfirm={handleResetShortcutsConfirm}
        onCancel={() => setIsResetShortcutsDialogOpen(false)}
      />
    </>
  )
}
