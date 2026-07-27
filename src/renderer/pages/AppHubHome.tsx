import type { AppFrontmatter } from '@shared/types/app-hub.types'
import { KIND_LABEL, STATUS_LABEL, STATUS_VALUES } from '@shared/types/app-hub.types'
import { AlertTriangle, ExternalLink, FolderOpen, RefreshCw, Search, Terminal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  openAppUrl,
  openClaudeTerminal,
  openFolder,
  openInVSCode,
  runSafeCommand
} from '@/lib/app-hub-launch'
import { useAppHubStore } from '@/stores/app-hub-store'

const STATUS_BADGE_CLASS: Record<string, string> = {
  production: 'bg-emerald-500/15 text-emerald-500',
  development: 'bg-amber-500/15 text-amber-500',
  paused: 'bg-neutral-500/15 text-neutral-400',
  archived: 'bg-neutral-500/10 text-neutral-500',
  planned: 'bg-sky-500/15 text-sky-500'
}

export default function AppHubHome(): React.JSX.Element {
  const { apps, isLoading, hasLoadedOnce, loadErrors, load } = useAppHubStore()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    if (!hasLoadedOnce) {
      void load()
    }
  }, [hasLoadedOnce, load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return apps.filter((app) => {
      const fm = app.frontmatter
      if (statusFilter !== 'all' && fm.status !== statusFilter) return false
      if (!q) return true
      const haystack = [
        fm.name,
        fm.slug,
        fm.company,
        fm.project_group,
        ...(fm.category ?? []),
        ...(fm.tags ?? []),
        fm.paths.local,
        fm.urls.production ?? '',
        fm.urls.github ?? ''
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [apps, query, statusFilter])

  const runAction = async (
    label: string,
    action: () => Promise<{ ok: boolean; message: string }>
  ) => {
    const result = await action()
    if (result.ok) {
      if (result.message) toast.success(result.message)
    } else {
      toast.error(result.message || `${label}に失敗しました`)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-5 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">アプリ</h1>
          <p className="text-sm text-muted-foreground mt-1">
            アプリ台帳ハブ(registry/apps)に登録されているアプリを表示しています。台帳の追加・編集はアプリ台帳ハブ側で行います。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-secondary/60 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          再読み込み
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="アプリ名・タグ・パス・URLで検索"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2 py-1.5 text-sm rounded-md border border-border bg-background"
        >
          <option value="all">すべての状態</option>
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {loadErrors.length > 0 && (
        <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-md p-2 flex items-start gap-1.5">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            {loadErrors.length}件のファイルを読み込めませんでした。
            {loadErrors.map((e) => (
              <div key={e.file} className="opacity-80">
                {e.file}: {e.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && apps.length === 0 ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">条件に一致するアプリがありません。</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((app) => (
            <AppCard
              key={app.frontmatter.slug}
              frontmatter={app.frontmatter}
              runAction={runAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AppCard({
  frontmatter: fm,
  runAction
}: {
  frontmatter: AppFrontmatter
  runAction: (
    label: string,
    action: () => Promise<{ ok: boolean; message: string }>
  ) => Promise<void>
}): React.JSX.Element {
  const primaryUrl = fm.urls.production ?? fm.urls.admin ?? null

  return (
    <div className="border border-border rounded-lg p-4 space-y-2.5 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">{fm.name}</div>
          <div className="text-xs text-muted-foreground">{KIND_LABEL[fm.kind]}</div>
        </div>
        <span
          className={`text-[11px] px-1.5 py-0.5 rounded shrink-0 ${STATUS_BADGE_CLASS[fm.status] ?? ''}`}
        >
          {STATUS_LABEL[fm.status]}
        </span>
      </div>

      {fm.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {fm.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground truncate" title={fm.paths.local}>
        {fm.paths.local}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => void runAction('フォルダを開く', () => openFolder(fm.paths.local))}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60"
        >
          <FolderOpen size={12} />
          フォルダ
        </button>
        <button
          type="button"
          onClick={() => void runAction('VS Codeで開く', () => openInVSCode(fm.paths.local))}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60"
        >
          VS Code
        </button>
        <button
          type="button"
          onClick={() =>
            void runAction('Claude Codeを開く', () => openClaudeTerminal(fm.paths.local))
          }
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60"
        >
          <Terminal size={12} />
          Claude Code
        </button>
        {primaryUrl && (
          <button
            type="button"
            onClick={() => void runAction('画面を見る', () => openAppUrl(primaryUrl))}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60"
          >
            <ExternalLink size={12} />
            画面を見る
          </button>
        )}
      </div>

      {fm.safe_commands.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/60">
          {fm.safe_commands.map((cmd) => (
            <button
              key={cmd.id}
              type="button"
              onClick={() =>
                void runAction(cmd.label, () =>
                  runSafeCommand(cmd.command, cmd.args, cmd.cwd ?? fm.paths.local)
                )
              }
              className="px-2 py-1 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20"
            >
              {cmd.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
