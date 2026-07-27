// Context bar visibility settings
export interface ContextBarSettings {
  showGitBranch: boolean
  showGitStatus: boolean
  showWorkingDirectory: boolean
  showExitCode: boolean
}

// Default settings with all elements visible
export const DEFAULT_CONTEXT_BAR_SETTINGS: ContextBarSettings = {
  showGitBranch: true,
  showGitStatus: true,
  showWorkingDirectory: true,
  showExitCode: true
}

// Persistence key for context bar settings
export const CONTEXT_BAR_SETTINGS_KEY = 'settings/context-bar'

// Table of contents panel settings
export interface TocSettings {
  isVisible: boolean
  maxHeadingLevel: number
  width: number
}

export const TOC_MIN_WIDTH = 150
export const TOC_MAX_WIDTH = 350

export const DEFAULT_TOC_SETTINGS: TocSettings = {
  isVisible: true,
  maxHeadingLevel: 3,
  width: 220
}

export const TOC_SETTINGS_KEY = 'settings/toc'

export type TerminalUrlOpenMode = 'system' | 'termul'

/** Which interface the remote terminal HTTP server binds to when started. */
export type RemoteBindMode = 'localhost' | 'all'

// Application-wide settings
export interface AppSettings {
  terminalFontFamily: string
  terminalFontSize: number
  terminalBufferSize: number // Scrollback buffer size in lines
  terminalRenderer: 'auto' | 'webgl' | 'dom'
  defaultShell: string
  defaultProjectColor: string // Default color for new projects (from PROJECT_COLORS)
  maxTerminalsPerProject: number // Maximum terminals allowed per project
  orphanDetectionEnabled: boolean // Enable automatic cleanup of inactive terminals
  orphanDetectionTimeout: number | null // Timeout in ms, null = disabled
  confirmTerminalClose: boolean // Show a confirmation dialog before closing a terminal
  terminalUrlOpenMode: TerminalUrlOpenMode // Controls how Ctrl/Cmd+Click terminal URLs are opened
  sidebarVisible: boolean
  fileExplorerVisible: boolean
  sshPanelVisible: boolean
  /** Remote server bind: localhost (127.0.0.1) or all interfaces (0.0.0.0). */
  remoteBindMode: RemoteBindMode
  /** App-wide color theme family id (without `-light` suffix). */
  colorTheme: string
  /** Light, dark, or follow OS (maps to `{colorTheme}` / `{colorTheme}-light`). */
  appearanceMode: 'light' | 'dark'
  /** Whole-UI zoom factor (1.0 = 100%). Scales the entire window like VS Code's window zoom. */
  uiZoomLevel: number
}

/** Whole-UI zoom bounds — match the native View menu semantics (0.5x–3.0x, 10% steps). */
export const UI_ZOOM_DEFAULT = 1.0
export const UI_ZOOM_MIN = 0.5
export const UI_ZOOM_MAX = 3.0
export const UI_ZOOM_STEP = 0.1

export type AppPanelVisibilitySettingKey =
  | 'sidebarVisible'
  | 'fileExplorerVisible'
  | 'sshPanelVisible'

export type AppSettingsUpdate = Partial<Omit<AppSettings, AppPanelVisibilitySettingKey>>

// Terminal buffer size options
export const BUFFER_SIZE_OPTIONS = [
  { value: 1000, label: '1,000行' },
  { value: 5000, label: '5,000行' },
  { value: 10000, label: '10,000行' },
  { value: 25000, label: '25,000行' },
  { value: 50000, label: '50,000行' }
]

// Font family options for terminal
export const FONT_FAMILY_OPTIONS = [
  { value: 'Menlo, Monaco, "Courier New", monospace', label: 'Menlo' },
  { value: 'Monaco, Menlo, "Courier New", monospace', label: 'Monaco' },
  { value: 'Consolas, "Courier New", monospace', label: 'Consolas' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New' },
  { value: '"Source Code Pro", Menlo, monospace', label: 'Source Code Pro' },
  { value: '"JetBrains Mono", Menlo, monospace', label: 'JetBrains Mono' },
  { value: '"Fira Code", Menlo, monospace', label: 'Fira Code' }
]

// Max terminals per project options
export const MAX_TERMINALS_OPTIONS = [
  { value: 5, label: '5個のターミナル' },
  { value: 10, label: '10個のターミナル' },
  { value: 15, label: '15個のターミナル' },
  { value: 20, label: '20個のターミナル' },
  { value: 50, label: '50個のターミナル' }
]

// Orphan detection timeout options
export const ORPHAN_TIMEOUT_OPTIONS = [
  { value: 60000, label: '1分' },
  { value: 300000, label: '5分' },
  { value: 600000, label: '10分' },
  { value: 1800000, label: '30分' },
  { value: 3600000, label: '1時間' }
]

// Terminal renderer strategy options
export const TERMINAL_RENDERER_OPTIONS = [
  { value: 'auto', label: '自動（WebGL優先、DOMにフォールバック）' },
  { value: 'webgl', label: 'WebGL' },
  { value: 'dom', label: 'DOM' }
]

// Terminal URL opening mode options
export const TERMINAL_URL_OPEN_MODE_OPTIONS: Array<{
  value: TerminalUrlOpenMode
  label: string
}> = [
  { value: 'system', label: 'システムの既定のブラウザ' },
  { value: 'termul', label: 'Termulブラウザ' }
]

export const REMOTE_BIND_MODE_OPTIONS: Array<{
  value: RemoteBindMode
  label: string
  description: string
}> = [
  {
    value: 'localhost',
    label: 'ローカルホストのみ（127.0.0.1）',
    description: 'このマシンからのみ直接接続できます。最も安全な既定設定です。'
  },
  {
    value: 'all',
    label: 'すべてのネットワークインターフェース（0.0.0.0）',
    description:
      'すべてのネットワークインターフェースで待ち受けます。LAN内の他のデバイスからこのポートにアクセスできます。'
  }
]

// Default application settings
export const DEFAULT_APP_SETTINGS: AppSettings = {
  terminalFontFamily: 'Menlo, Monaco, "Courier New", monospace',
  terminalFontSize: 14,
  terminalBufferSize: 10000,
  terminalRenderer: 'webgl',
  defaultShell: '',
  defaultProjectColor: 'blue',
  maxTerminalsPerProject: 10,
  orphanDetectionEnabled: true,
  orphanDetectionTimeout: 600000, // 10 minutes
  confirmTerminalClose: true,
  terminalUrlOpenMode: 'system',
  sidebarVisible: true,
  fileExplorerVisible: true,
  sshPanelVisible: true,
  remoteBindMode: 'localhost',
  colorTheme: 'termul',
  appearanceMode: 'dark',
  uiZoomLevel: UI_ZOOM_DEFAULT
}

// Persistence key for app settings
export const APP_SETTINGS_KEY = 'settings/app'

// Keyboard shortcut definition
export interface KeyboardShortcut {
  id: string
  label: string
  description: string
  defaultKey: string // Normalized format: "ctrl+k", "ctrl+shift+p"
  customKey?: string // User's custom binding, undefined = use default
}

// All keyboard shortcuts configuration
export type KeyboardShortcutsConfig = Record<string, KeyboardShortcut>

// Default keyboard shortcuts matching current WorkspaceDashboard handlers
export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcutsConfig = {
  commandPalette: {
    id: 'commandPalette',
    label: 'コマンドパレット',
    description: 'クイックアクション用のコマンドパレットを開きます',
    defaultKey: 'ctrl+k'
  },
  commandPaletteAlt: {
    id: 'commandPaletteAlt',
    label: 'コマンドパレット（代替）',
    description: 'コマンドパレットを開きます（VS Code形式）',
    defaultKey: 'ctrl+shift+p'
  },
  terminalSearch: {
    id: 'terminalSearch',
    label: 'ターミナル検索',
    description: 'ターミナルの出力内を検索します',
    defaultKey: 'ctrl+f'
  },
  commandHistory: {
    id: 'commandHistory',
    label: 'コマンド履歴',
    description: 'コマンド履歴を検索します',
    defaultKey: 'ctrl+r'
  },
  newProject: {
    id: 'newProject',
    label: '新規プロジェクト',
    description: '新しいプロジェクトを作成します',
    defaultKey: 'ctrl+n'
  },
  newTerminal: {
    id: 'newTerminal',
    label: 'エージェント起動',
    description: 'アクティブなペインにエージェント起動プロンプトを表示します',
    defaultKey: 'ctrl+t'
  },
  newBrowserTab: {
    id: 'newBrowserTab',
    label: '新規ブラウザタブ',
    description: '新しいブラウザタブを作成します',
    defaultKey: 'ctrl+shift+n'
  },
  nextTerminal: {
    id: 'nextTerminal',
    label: '次のタブ',
    description:
      '次のタブ（ターミナルまたはエディタ）に切り替えます（Tauri対応のフォールバック使用）',
    defaultKey: 'ctrl+pagedown'
  },
  prevTerminal: {
    id: 'prevTerminal',
    label: '前のタブ',
    description:
      '前のタブ（ターミナルまたはエディタ）に切り替えます（Tauri対応のフォールバック使用）',
    defaultKey: 'ctrl+pageup'
  },
  zoomIn: {
    id: 'zoomIn',
    label: '拡大',
    description: '画面全体を拡大します',
    defaultKey: 'ctrl+='
  },
  zoomOut: {
    id: 'zoomOut',
    label: '縮小',
    description: '画面全体を縮小します',
    defaultKey: 'ctrl+-'
  },
  zoomReset: {
    id: 'zoomReset',
    label: '拡大率をリセット',
    description: '画面全体の拡大率を100%に戻します',
    defaultKey: 'ctrl+0'
  },
  sidebarToggle: {
    id: 'sidebarToggle',
    label: 'サイドバー表示切替',
    description: 'プロジェクトサイドバーの表示・非表示を切り替えます',
    defaultKey: 'ctrl+shift+b'
  },
  closeTab: {
    id: 'closeTab',
    label: 'タブを閉じる',
    description: 'アクティブなタブ（ターミナル・エディタ・ブラウザ）を閉じます',
    defaultKey: 'ctrl+w'
  },
  saveFile: {
    id: 'saveFile',
    label: 'ファイルを保存',
    description: 'エディタで開いているファイルを保存します',
    defaultKey: 'ctrl+s'
  },
  toggleFileExplorer: {
    id: 'toggleFileExplorer',
    label: 'ファイルエクスプローラー表示切替',
    description: 'ファイルエクスプローラーパネルの表示・非表示を切り替えます',
    defaultKey: 'ctrl+b'
  },
  fileExplorerRename: {
    id: 'fileExplorerRename',
    label: 'ファイル名を変更',
    description: '選択したファイルの名前を変更します',
    defaultKey: 'f2'
  },
  fileExplorerDelete: {
    id: 'fileExplorerDelete',
    label: 'ファイルを削除',
    description: '選択したファイルを削除します',
    defaultKey: 'delete'
  },

  // Worktree shortcuts
  worktreeCreate: {
    id: 'worktreeCreate',
    label: 'ワークツリーを作成',
    description: '新規ワークツリー作成ダイアログを開きます',
    defaultKey: 'ctrl+shift+alt+n'
  },
  worktreeSwitchNext: {
    id: 'worktreeSwitchNext',
    label: '次のワークツリーに切替',
    description: 'サイドバーで次のワークツリーに切り替えます',
    defaultKey: 'ctrl+shift+downarrow'
  },
  worktreeSwitchPrev: {
    id: 'worktreeSwitchPrev',
    label: '前のワークツリーに切替',
    description: 'サイドバーで前のワークツリーに切り替えます',
    defaultKey: 'ctrl+shift+uparrow'
  },
  worktreeOpenTerminal: {
    id: 'worktreeOpenTerminal',
    label: 'ワークツリーでターミナルを開く',
    description: 'アクティブなワークツリーで新しいターミナルを起動します',
    defaultKey: 'ctrl+shift+alt+t'
  },
  worktreeMergeToMain: {
    id: 'worktreeMergeToMain',
    label: 'ワークツリーをmainにマージ',
    description: 'マージ作業を開始します（ワークツリーのブランチ→main）',
    defaultKey: 'ctrl+shift+m'
  },
  worktreeSyncMain: {
    id: 'worktreeSyncMain',
    label: 'mainをワークツリーに同期',
    description: 'マージ作業を開始します（main→ワークツリーのブランチ）',
    defaultKey: 'ctrl+shift+alt+s'
  },
  worktreeArchive: {
    id: 'worktreeArchive',
    label: 'アクティブなワークツリーをアーカイブ',
    description: '現在アクティブなワークツリーをアーカイブします',
    defaultKey: 'ctrl+shift+a'
  },
  worktreeSwitchRoot: {
    id: 'worktreeSwitchRoot',
    label: 'プロジェクトルートに切替',
    description: 'アクティブなコンテキストをプロジェクトルートディレクトリに切り替えます',
    defaultKey: 'ctrl+shift+home'
  },
  colorThemePicker: {
    id: 'colorThemePicker',
    label: '配色テーマを変更',
    description: 'ライブプレビュー付きの配色テーマ選択を開きます',
    defaultKey: 'ctrl+alt+t'
  }
}

// Persistence key for keyboard shortcuts
export const KEYBOARD_SHORTCUTS_KEY = 'settings/keyboard-shortcuts'
