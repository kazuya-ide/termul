import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@/types/project'
import { CommandPalette } from './CommandPalette'

window.HTMLElement.prototype.scrollIntoView = vi.fn()

const saveRecentCommand = vi.fn(() => Promise.resolve())
let recentCommandIds: string[] = []

const togglePinnedCommand = vi.fn(() => Promise.resolve())
let pinnedCommandIds: string[] = []

vi.mock('@/hooks/use-recent-commands', () => ({
  useRecentCommandIds: () => recentCommandIds,
  useSaveRecentCommand: () => saveRecentCommand
}))

vi.mock('@/hooks/use-pinned-commands', () => ({
  usePinnedCommandIds: () => pinnedCommandIds,
  useTogglePinnedCommand: () => togglePinnedCommand
}))

const projects: Project[] = [
  {
    id: 'alpha',
    name: 'Alpha',
    color: 'blue',
    path: '/work/alpha'
  },
  {
    id: 'beta',
    name: 'Beta',
    color: 'green',
    path: '/work/beta'
  }
]

function renderPalette(overrides: Partial<React.ComponentProps<typeof CommandPalette>> = {}) {
  const props: React.ComponentProps<typeof CommandPalette> = {
    isOpen: true,
    onClose: vi.fn(),
    projects,
    onSwitchProject: vi.fn(),
    onAddTerminal: vi.fn(),
    onShowAgentLauncher: vi.fn(),
    onSaveSnapshot: vi.fn(),
    onNewBrowserTab: vi.fn(),
    onOpenProjectSettings: vi.fn(),
    onOpenAppPreferences: vi.fn(),
    onOpenCommandHistory: vi.fn(),
    onOpenShortcutMenu: vi.fn(),
    onOpenThemePicker: vi.fn(),
    getShortcutLabel: (id) => {
      const labels: Record<string, string> = {
        newTerminal: 'Ctrl+T',
        newBrowserTab: 'Ctrl+Shift+N',
        commandHistory: 'Ctrl+R',
        colorThemePicker: 'Ctrl+Alt+T'
      }
      return labels[id]
    },
    getProjectShortcutLabel: (index) => `Ctrl+${index + 1}`,
    ...overrides
  }

  return {
    ...render(<CommandPalette {...props} />),
    props
  }
}

describe('CommandPalette', () => {
  beforeEach(() => {
    recentCommandIds = []
    pinnedCommandIds = []
    saveRecentCommand.mockClear()
    togglePinnedCommand.mockClear()
  })

  it('renders a compact command-center layout with metadata, categories, shortcuts, and footer hints', () => {
    renderPalette()

    expect(screen.getByPlaceholderText('コマンド、プロジェクト、設定を検索...')).toBeInTheDocument()
    expect(screen.getByText('ワークスペース')).toBeInTheDocument()
    expect(screen.getByText('ナビゲーション')).toBeInTheDocument()
    expect(screen.getByText('プロジェクト')).toBeInTheDocument()
    expect(screen.getByText('ツール')).toBeInTheDocument()
    expect(screen.getByText('アクティブなパネルで新しいシェルを開く')).toBeInTheDocument()
    expect(
      screen.getByText('アクティブなパネルにエージェントランチャーのプロンプトを表示')
    ).toBeInTheDocument()
    expect(screen.getByText('Ctrl+T')).toBeInTheDocument()
    expect(screen.getByText('移動')).toBeInTheDocument()
    expect(screen.getByText('選択')).toBeInTheDocument()
    expect(screen.getByText('閉じる')).toBeInTheDocument()
  })

  it('orders the Projects group above Workspace, Navigation, and Tools', () => {
    const { container } = renderPalette()

    const headings = Array.from(container.querySelectorAll('[cmdk-group-heading]')).map(
      (el) => el.textContent
    )

    const projectsIndex = headings.indexOf('プロジェクト')
    expect(projectsIndex).toBeGreaterThanOrEqual(0)
    expect(projectsIndex).toBeLessThan(headings.indexOf('ワークスペース'))
    expect(projectsIndex).toBeLessThan(headings.indexOf('ナビゲーション'))
    expect(projectsIndex).toBeLessThan(headings.indexOf('ツール'))
  })

  it('uses resolved shortcut labels supplied by the shell', () => {
    renderPalette({
      getShortcutLabel: (id) => {
        const labels: Record<string, string> = {
          newTerminal: 'Alt+T',
          newBrowserTab: 'Alt+B',
          commandHistory: 'Alt+H',
          colorThemePicker: 'Alt+Shift+T'
        }
        return labels[id]
      },
      getProjectShortcutLabel: (index) => `Alt+${index + 1}`
    })

    expect(screen.getByText('Alt+T')).toBeInTheDocument()
    expect(screen.getByText('Alt+B')).toBeInTheDocument()
    expect(screen.getByText('Alt+H')).toBeInTheDocument()
    expect(screen.getByText('Alt+Shift+T')).toBeInTheDocument()
    expect(screen.getByText('Alt+1')).toBeInTheDocument()
    expect(screen.queryByText('Ctrl+T')).not.toBeInTheDocument()
    expect(screen.queryByText('Ctrl+Shift+N')).not.toBeInTheDocument()
    expect(screen.queryByText('Ctrl+R')).not.toBeInTheDocument()
  })

  it('searches settings, prefs, and history keywords', async () => {
    renderPalette()
    const input = screen.getByPlaceholderText('コマンド、プロジェクト、設定を検索...')

    fireEvent.change(input, { target: { value: 'settings' } })
    await waitFor(() => {
      expect(screen.getByText('プロジェクト設定')).toBeInTheDocument()
      expect(screen.getByText('アプリの環境設定')).toBeInTheDocument()
    })

    fireEvent.change(input, { target: { value: 'prefs' } })
    await waitFor(() => {
      expect(screen.getByText('アプリの環境設定')).toBeInTheDocument()
    })

    fireEvent.change(input, { target: { value: 'history' } })
    await waitFor(() => {
      expect(screen.getByText('コマンド履歴')).toBeInTheDocument()
      expect(screen.getByText('直近のターミナルコマンドを確認・再利用')).toBeInTheDocument()
    })
  })

  it('switches projects, closes, and records recent command id', async () => {
    const { props } = renderPalette()

    fireEvent.click(screen.getByText('Beta'))

    await waitFor(() => {
      expect(saveRecentCommand).toHaveBeenCalledWith('project-beta')
      expect(props.onClose).toHaveBeenCalled()
      expect(props.onSwitchProject).toHaveBeenCalledWith('beta')
    })
  })

  it('renders project rows with a bare name and no "Switch to Project:" prefix', () => {
    renderPalette()

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText('Switch to Project: Alpha')).not.toBeInTheDocument()
    expect(screen.queryByText('Switch to Project: Beta')).not.toBeInTheDocument()
  })

  it('executes optional callbacks after closing and records selected command ids', async () => {
    const cases: Array<{
      label: string
      commandId: string
      callback: keyof React.ComponentProps<typeof CommandPalette>
    }> = [
      { label: '新規ターミナル', commandId: 'new-terminal', callback: 'onAddTerminal' },
      {
        label: 'エージェントランチャー',
        commandId: 'show-agent-launcher',
        callback: 'onShowAgentLauncher'
      },
      { label: '新規ブラウザタブ', commandId: 'new-browser-tab', callback: 'onNewBrowserTab' },
      {
        label: 'ワークスペースのスナップショットを保存',
        commandId: 'save-snapshot',
        callback: 'onSaveSnapshot'
      },
      {
        label: 'プロジェクト設定',
        commandId: 'open-project-settings',
        callback: 'onOpenProjectSettings'
      },
      {
        label: 'アプリの環境設定',
        commandId: 'open-app-preferences',
        callback: 'onOpenAppPreferences'
      },
      {
        label: 'コマンド履歴',
        commandId: 'open-command-history',
        callback: 'onOpenCommandHistory'
      },
      {
        label: 'ショートカットメニューを開く',
        commandId: 'open-shortcut-menu',
        callback: 'onOpenShortcutMenu'
      },
      {
        label: 'カラーテーマを変更',
        commandId: 'change-color-theme',
        callback: 'onOpenThemePicker'
      }
    ]

    for (const testCase of cases) {
      saveRecentCommand.mockClear()
      const { props, unmount } = renderPalette()

      fireEvent.click(screen.getByText(testCase.label))

      await waitFor(() => {
        expect(saveRecentCommand).toHaveBeenCalledWith(testCase.commandId)
        expect(props.onClose).toHaveBeenCalled()
        expect(props[testCase.callback]).toHaveBeenCalled()
      })

      unmount()
    }
  })

  it('omits optional commands when callbacks are unavailable', () => {
    renderPalette({
      onAddTerminal: undefined,
      onShowAgentLauncher: undefined,
      onSaveSnapshot: undefined,
      onNewBrowserTab: undefined,
      onOpenProjectSettings: undefined,
      onOpenAppPreferences: undefined,
      onOpenCommandHistory: undefined,
      onOpenShortcutMenu: undefined,
      onOpenThemePicker: undefined
    })

    expect(screen.queryByText('新規ターミナル')).not.toBeInTheDocument()
    expect(screen.queryByText('エージェントランチャー')).not.toBeInTheDocument()
    expect(screen.queryByText('新規ブラウザタブ')).not.toBeInTheDocument()
    expect(screen.queryByText('ワークスペースのスナップショットを保存')).not.toBeInTheDocument()
    expect(screen.queryByText('プロジェクト設定')).not.toBeInTheDocument()
    expect(screen.queryByText('アプリの環境設定')).not.toBeInTheDocument()
    expect(screen.queryByText('コマンド履歴')).not.toBeInTheDocument()
    expect(screen.queryByText('ショートカットメニューを開く')).not.toBeInTheDocument()
    expect(screen.queryByText('カラーテーマを変更')).not.toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('keeps recent commands visible when the search is empty', () => {
    recentCommandIds = ['open-command-history', 'project-alpha']

    renderPalette()

    expect(screen.getByText('最近使った')).toBeInTheDocument()
    expect(screen.getAllByText('コマンド履歴')).toHaveLength(2)
    expect(screen.getAllByText('Alpha')).toHaveLength(2)
  })

  it('renders a Pinned group with pinned commands when the search is empty', () => {
    pinnedCommandIds = ['new-terminal', 'project-beta']

    renderPalette()

    expect(screen.getByText('ピン留め')).toBeInTheDocument()
    expect(screen.getAllByText('新規ターミナル')).toHaveLength(2)
    expect(screen.getAllByText('Beta')).toHaveLength(2)
  })

  it('ignores pinned ids that do not resolve to a current command', () => {
    pinnedCommandIds = ['does-not-exist']

    renderPalette()

    expect(screen.queryByText('ピン留め')).not.toBeInTheDocument()
  })

  it('toggles a pin without executing the command or closing the palette', async () => {
    const { props } = renderPalette()

    const pinButton = screen.getByLabelText('新規ターミナル をピン留め')
    fireEvent.click(pinButton)

    await waitFor(() => {
      expect(togglePinnedCommand).toHaveBeenCalledWith('new-terminal')
    })
    expect(props.onClose).not.toHaveBeenCalled()
    expect(props.onAddTerminal).not.toHaveBeenCalled()
    expect(saveRecentCommand).not.toHaveBeenCalled()
  })

  it('labels the toggle as Unpin for an already-pinned command', () => {
    pinnedCommandIds = ['new-terminal']

    renderPalette()

    expect(screen.getAllByLabelText('新規ターミナル のピン留めを解除').length).toBeGreaterThan(0)
  })

  it('keeps optimistic pin state when persistence fails', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    togglePinnedCommand.mockRejectedValueOnce(new Error('storage unavailable'))
    const { props } = renderPalette()

    fireEvent.click(screen.getByLabelText('ワークスペースのスナップショットを保存 をピン留め'))

    await waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith('Failed to toggle pinned command', expect.any(Error))
    })
    expect(props.onClose).not.toHaveBeenCalled()
    expect(props.onSaveSnapshot).not.toHaveBeenCalled()

    consoleWarn.mockRestore()
  })

  it('runs a command when recent-command persistence fails', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    saveRecentCommand.mockRejectedValueOnce(new Error('storage unavailable'))
    const { props } = renderPalette()

    fireEvent.click(screen.getByText('ワークスペースのスナップショットを保存'))

    await waitFor(() => {
      expect(props.onClose).toHaveBeenCalled()
      expect(props.onSaveSnapshot).toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledWith('Failed to save recent command', expect.any(Error))
    })

    consoleWarn.mockRestore()
  })

  it('closes on Escape and backdrop click', () => {
    const { container, props } = renderPalette()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)

    const backdrop = container.querySelector('.fixed.inset-0')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop as Element)
    expect(props.onClose).toHaveBeenCalledTimes(2)
  })
})
