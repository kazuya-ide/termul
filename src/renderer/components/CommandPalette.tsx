import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot,
  Globe,
  History,
  Keyboard,
  Layers,
  Monitor,
  Palette,
  Pin,
  Save,
  Settings,
  SlidersHorizontal,
  Terminal
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@/components/ui/command'
import { usePinnedCommandIds, useTogglePinnedCommand } from '@/hooks/use-pinned-commands'
import { useRecentCommandIds, useSaveRecentCommand } from '@/hooks/use-recent-commands'
import { getColorClasses } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { Project, ProjectColor } from '@/types/project'

type CommandShortcutId = 'newTerminal' | 'newBrowserTab' | 'commandHistory' | 'colorThemePicker'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  projects: Project[]
  onSwitchProject: (id: string) => void
  onAddTerminal?: () => void
  onShowAgentLauncher?: () => void
  onLaunchAgent?: () => void
  onSaveSnapshot?: () => void
  onNewBrowserTab?: () => void
  onOpenProjectSettings?: () => void
  onOpenAppPreferences?: () => void
  onOpenCommandHistory?: () => void
  onOpenShortcutMenu?: () => void
  onOpenThemePicker?: () => void
  onSSHConnect?: (profileId: string) => void
  sshProfiles?: Array<{ id: string; name: string; host: string; username: string }>
  getShortcutLabel?: (id: CommandShortcutId) => string | undefined
  getProjectShortcutLabel?: (index: number) => string | undefined
}

type CommandCategory = 'workspace' | 'navigation' | 'projects' | 'tools'

const COMMAND_CATEGORY_LABELS: Record<CommandCategory, string> = {
  workspace: 'ワークスペース',
  navigation: 'ナビゲーション',
  projects: 'プロジェクト',
  tools: 'ツール'
}

const COMMAND_CATEGORY_ORDER: CommandCategory[] = ['projects', 'workspace', 'navigation', 'tools']

interface CommandDef {
  id: string
  category: CommandCategory
  icon: React.ReactNode
  label: string
  description?: string
  keywords?: string[]
  shortcut?: string
  execute: () => void
  projectColor?: ProjectColor
}

function getSearchableValue(cmd: CommandDef): string {
  return [
    cmd.label,
    cmd.description,
    cmd.category,
    COMMAND_CATEGORY_LABELS[cmd.category],
    ...(cmd.keywords ?? [])
  ]
    .filter(Boolean)
    .join(' ')
}

export function CommandPalette({
  isOpen,
  onClose,
  projects,
  onSwitchProject,
  onAddTerminal,
  onShowAgentLauncher,
  onLaunchAgent,
  onSaveSnapshot,
  onNewBrowserTab,
  onOpenProjectSettings,
  onOpenAppPreferences,
  onOpenCommandHistory,
  onOpenShortcutMenu,
  onOpenThemePicker,
  onSSHConnect,
  sshProfiles,
  getShortcutLabel,
  getProjectShortcutLabel
}: CommandPaletteProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const recentCommandIds = useRecentCommandIds()
  const saveRecentCommand = useSaveRecentCommand()
  const pinnedCommandIds = usePinnedCommandIds()
  const togglePinnedCommand = useTogglePinnedCommand()

  const commands: CommandDef[] = useMemo(
    () => [
      ...(onAddTerminal
        ? [
            {
              id: 'new-terminal',
              category: 'workspace' as const,
              icon: <Terminal aria-hidden="true" size={16} />,
              label: '新規ターミナル',
              description: 'アクティブなパネルで新しいシェルを開く',
              keywords: ['shell', 'console', 'pty', 'workspace'],
              execute: onAddTerminal
            }
          ]
        : []),
      ...(onShowAgentLauncher
        ? [
            {
              id: 'show-agent-launcher',
              category: 'workspace' as const,
              icon: <Bot aria-hidden="true" size={16} />,
              label: 'エージェントランチャー',
              description: 'アクティブなパネルにエージェントランチャーのプロンプトを表示',
              keywords: ['agent', 'ai', 'claude', 'codex', 'prompt', 'launcher'],
              shortcut: getShortcutLabel?.('newTerminal'),
              execute: onShowAgentLauncher
            }
          ]
        : []),
      ...(onLaunchAgent
        ? [
            {
              id: 'launch-agent',
              category: 'workspace' as const,
              icon: <Bot aria-hidden="true" size={16} />,
              label: 'エージェントを起動',
              description: 'アクティブなパネルでCLIエージェントのTUIを開く',
              keywords: ['agent', 'ai', 'claude', 'codex', 'gemini', 'cursor', 'opencode', 'cli'],
              execute: onLaunchAgent
            }
          ]
        : []),
      ...(onNewBrowserTab
        ? [
            {
              id: 'new-browser-tab',
              category: 'workspace' as const,
              icon: <Globe aria-hidden="true" size={16} />,
              label: '新規ブラウザタブ',
              description: 'アクティブなパネルでブラウザタブを開く',
              keywords: ['web', 'url', 'workspace'],
              shortcut: getShortcutLabel?.('newBrowserTab'),
              execute: onNewBrowserTab
            }
          ]
        : []),
      ...(onSaveSnapshot
        ? [
            {
              id: 'save-snapshot',
              category: 'workspace' as const,
              icon: <Save aria-hidden="true" size={16} />,
              label: 'ワークスペースのスナップショットを保存',
              description: '現在のワークスペースの配置を記録',
              keywords: ['snapshot', 'checkpoint', 'layout', 'save'],
              execute: onSaveSnapshot
            }
          ]
        : []),
      ...(onOpenProjectSettings
        ? [
            {
              id: 'open-project-settings',
              category: 'navigation' as const,
              icon: <Settings aria-hidden="true" size={16} />,
              label: 'プロジェクト設定',
              description: 'アクティブなプロジェクトのワークスペースを設定',
              keywords: ['settings', 'project', 'configure', 'config'],
              execute: onOpenProjectSettings
            }
          ]
        : []),
      ...(onOpenAppPreferences
        ? [
            {
              id: 'open-app-preferences',
              category: 'navigation' as const,
              icon: <SlidersHorizontal aria-hidden="true" size={16} />,
              label: 'アプリの環境設定',
              description: 'アプリ全体の環境設定を開く',
              keywords: ['preferences', 'prefs', 'settings', 'app', 'global'],
              execute: onOpenAppPreferences
            }
          ]
        : []),
      ...projects.map((project, index) => ({
        id: `project-${project.id}`,
        category: 'projects' as const,
        icon: (
          <Layers aria-hidden="true" size={16} className={getColorClasses(project.color).text} />
        ),
        label: project.name,
        description: project.path ?? 'アクティブなワークスペースのプロジェクトを切り替え',
        keywords: ['project', 'switch', project.name, project.path].filter(
          (keyword): keyword is string => Boolean(keyword)
        ),
        shortcut: index < 9 ? getProjectShortcutLabel?.(index) : undefined,
        execute: () => onSwitchProject(project.id),
        projectColor: project.color
      })),
      ...(onOpenCommandHistory
        ? [
            {
              id: 'open-command-history',
              category: 'tools' as const,
              icon: <History aria-hidden="true" size={16} />,
              label: 'コマンド履歴',
              description: '直近のターミナルコマンドを確認・再利用',
              keywords: ['history', 'recent', 'terminal', 'commands', 'shell'],
              shortcut: getShortcutLabel?.('commandHistory'),
              execute: onOpenCommandHistory
            }
          ]
        : []),
      ...(onOpenThemePicker
        ? [
            {
              id: 'change-color-theme',
              category: 'tools' as const,
              icon: <Palette aria-hidden="true" size={16} />,
              label: 'カラーテーマを変更',
              description: 'UIのカラーテーマをプレビュー・適用',
              keywords: ['theme', 'color', 'appearance', 'palette', 'dark', 'dracula', 'nord'],
              shortcut: getShortcutLabel?.('colorThemePicker'),
              execute: onOpenThemePicker
            }
          ]
        : []),
      ...(onOpenShortcutMenu
        ? [
            {
              id: 'open-shortcut-menu',
              category: 'tools' as const,
              icon: <Keyboard aria-hidden="true" size={16} />,
              label: 'ショートカットメニューを開く',
              description: 'よく使うキーボードショートカットを確認・編集',
              keywords: ['keyboard', 'shortcuts', 'hotkeys', 'keys'],
              execute: onOpenShortcutMenu
            }
          ]
        : []),
      ...(onSSHConnect && sshProfiles
        ? sshProfiles.map((profile) => ({
            id: `ssh-${profile.id}`,
            category: 'tools' as const,
            icon: <Monitor aria-hidden="true" size={16} />,
            label: `SSH: ${profile.name}`,
            description: `${profile.username}@${profile.host}`,
            keywords: ['ssh', 'remote', 'connect', profile.name, profile.host, profile.username],
            execute: () => onSSHConnect(profile.id)
          }))
        : [])
    ],
    [
      projects,
      onSwitchProject,
      onAddTerminal,
      onShowAgentLauncher,
      onLaunchAgent,
      onSaveSnapshot,
      onNewBrowserTab,
      onOpenProjectSettings,
      onOpenAppPreferences,
      onOpenCommandHistory,
      onOpenShortcutMenu,
      onOpenThemePicker,
      onSSHConnect,
      sshProfiles,
      getShortcutLabel,
      getProjectShortcutLabel
    ]
  )

  const { pinnedCommands, recentCommands, commandsByCategory } = useMemo(() => {
    const commandById = new Map(commands.map((cmd) => [cmd.id, cmd]))

    const pinned: CommandDef[] = []
    for (const id of pinnedCommandIds) {
      const cmd = commandById.get(id)
      if (cmd) {
        pinned.push(cmd)
      }
    }

    const recent: CommandDef[] = []
    const recentIds = new Set(recentCommandIds)

    for (const cmd of commands) {
      if (recentIds.has(cmd.id)) {
        recent.push(cmd)
      }
    }

    recent.sort((a, b) => recentCommandIds.indexOf(a.id) - recentCommandIds.indexOf(b.id))

    const grouped = COMMAND_CATEGORY_ORDER.map((category) => ({
      category,
      commands: commands.filter((cmd) => cmd.category === category)
    })).filter((group) => group.commands.length > 0)

    return {
      pinnedCommands: pinned,
      recentCommands: recent,
      commandsByCategory: grouped
    }
  }, [commands, pinnedCommandIds, recentCommandIds])

  const pinnedIdSet = useMemo(() => new Set(pinnedCommandIds), [pinnedCommandIds])

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      // Explicitly blur active element first so terminal doesn't hold focus,
      // then focus the command palette input after the overlay renders.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  const executeCommand = useCallback(
    async (cmd: CommandDef) => {
      try {
        await saveRecentCommand(cmd.id)
      } catch (error) {
        console.warn('Failed to save recent command', error)
      }

      onClose()
      cmd.execute()
    },
    [saveRecentCommand, onClose]
  )

  const togglePin = useCallback(
    async (commandId: string) => {
      try {
        await togglePinnedCommand(commandId)
      } catch (error) {
        console.warn('Failed to toggle pinned command', error)
      }
    },
    [togglePinnedCommand]
  )

  // Handle Escape key - use capture phase to intercept before cmdk handles it
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isOpen, onClose])

  const renderCommandItem = (cmd: CommandDef, keyPrefix?: string): React.JSX.Element => {
    const isPinned = pinnedIdSet.has(cmd.id)
    return (
      <CommandItem
        key={keyPrefix ? `${keyPrefix}:${cmd.id}` : cmd.id}
        value={keyPrefix ? `${keyPrefix}:${getSearchableValue(cmd)}` : getSearchableValue(cmd)}
        onSelect={() => executeCommand(cmd)}
        className="group flex items-center justify-between gap-3 px-2.5 py-1.5 cursor-pointer rounded-md data-[selected='true']:bg-background data-[selected=true]:text-foreground"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary/70 text-muted-foreground group-data-[selected=true]:text-foreground',
              cmd.projectColor && getColorClasses(cmd.projectColor).bg
            )}
          >
            {cmd.icon}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium leading-5">{cmd.label}</span>
            {cmd.description && (
              <span className="truncate text-xs leading-4 text-muted-foreground">
                {cmd.description}
              </span>
            )}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {cmd.shortcut && (
            <CommandShortcut className="rounded border border-border bg-secondary/70 px-1.5 py-0.5 font-mono text-3xs tracking-normal text-muted-foreground">
              {cmd.shortcut}
            </CommandShortcut>
          )}
          <button
            type="button"
            aria-label={isPinned ? `${cmd.label} のピン留めを解除` : `${cmd.label} をピン留め`}
            aria-pressed={isPinned}
            title={isPinned ? 'ピン留めを解除' : 'ピン留め'}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void togglePin(cmd.id)
            }}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-secondary hover:text-foreground group-data-[selected=true]:text-foreground',
              isPinned
                ? 'text-foreground opacity-100'
                : 'opacity-0 group-data-[selected=true]:opacity-100 group-hover:opacity-100'
            )}
          >
            <Pin aria-hidden="true" size={13} className={cn(isPinned && 'fill-current')} />
          </button>
        </div>
      </CommandItem>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col items-center pt-[7vh] bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-3xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
              shouldFilter={true}
            >
              <CommandInput
                ref={inputRef}
                placeholder="コマンド、プロジェクト、設定を検索..."
                value={query}
                onValueChange={setQuery}
                className="h-10 py-2 text-sm"
              />
              <CommandList className="max-h-[52vh] px-1 py-1">
                <CommandEmpty>コマンドが見つかりません。</CommandEmpty>

                {pinnedCommands.length > 0 && query === '' && (
                  <CommandGroup heading="ピン留め">
                    {pinnedCommands.map((cmd) => renderCommandItem(cmd, 'pinned'))}
                  </CommandGroup>
                )}

                {recentCommands.length > 0 && query === '' && (
                  <CommandGroup heading="最近使った">
                    {recentCommands.map((cmd) => renderCommandItem(cmd, 'recent'))}
                  </CommandGroup>
                )}

                {commandsByCategory.map(({ category, commands: categoryCommands }) => (
                  <CommandGroup key={category} heading={COMMAND_CATEGORY_LABELS[category]}>
                    {categoryCommands.map((cmd) => renderCommandItem(cmd))}
                  </CommandGroup>
                ))}
              </CommandList>

              <div className="label-group flex items-center justify-end gap-3 border-t border-border bg-background px-3 py-2 text-muted-foreground">
                <span className="flex items-center gap-3">
                  <span className="flex items-center">
                    <kbd className="mr-1 rounded bg-secondary px-1 text-foreground">↑↓</kbd>
                    移動
                  </span>
                  <span className="flex items-center">
                    <kbd className="mr-1 rounded bg-secondary px-1 text-foreground">↵</kbd>
                    選択
                  </span>
                  <span className="flex items-center">
                    <kbd className="mr-1 rounded bg-secondary px-1 text-foreground">Esc</kbd>
                    閉じる
                  </span>
                </span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
