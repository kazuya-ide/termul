import type { AppFrontmatter, AppRecord } from '@shared/types/app-hub.types'
import { KIND_LABEL, STATUS_LABEL, STATUS_VALUES } from '@shared/types/app-hub.types'
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  FolderOpen,
  Info,
  ListTodo,
  Pin,
  Play,
  RefreshCw,
  ScanSearch,
  Search,
  Square,
  Terminal
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { DetectedCandidate } from '@/lib/app-hub-detect'
import { DEFAULT_SCAN_ROOTS, detectUnregisteredApps } from '@/lib/app-hub-detect'
import { extractOverviewExcerpt, extractSection } from '@/lib/app-hub-format'
import {
  openAppUrl,
  openClaudeTerminal,
  openFolder,
  openInVSCode,
  previewAppUrl,
  runSafeCommand
} from '@/lib/app-hub-launch'
import { loadThumbnailDataUrl, resolveThumbnailPath } from '@/lib/app-hub-thumbnail'
import { useAppHubProcessStore } from '@/stores/app-hub-process-store'
import type { PathStatus } from '@/stores/app-hub-store'
import { useAppHubStore } from '@/stores/app-hub-store'

const STATUS_BADGE_CLASS: Record<string, string> = {
  production: 'bg-emerald-500/15 text-emerald-500',
  development: 'bg-amber-500/15 text-amber-500',
  paused: 'bg-neutral-500/15 text-neutral-400',
  archived: 'bg-neutral-500/10 text-neutral-500',
  planned: 'bg-sky-500/15 text-sky-500'
}

type SortKey = 'name' | 'updated' | 'status' | 'company'

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'name', label: '名前順' },
  { value: 'updated', label: '更新が新しい順' },
  { value: 'status', label: '状態順(稼働中→計画中)' },
  { value: 'company', label: '会社順' }
]

// 状態の並び順(稼働中を先頭に)。
const STATUS_ORDER: Record<string, number> = {
  production: 0,
  development: 1,
  planned: 2,
  paused: 3,
  archived: 4
}

/**
 * カード一覧の並び替え。どの並び順でも共通で:
 *  1. pinned(ピン留め)を最上段に固定
 *  2. sort_order(手動の並び番号。小さいほど前・null は後ろ)
 *  3. 選んだ並び順キー(名前/更新日/状態/会社)
 *  4. 最後は名前で安定させる
 */
function sortApps(list: AppRecord[], key: SortKey): AppRecord[] {
  return [...list].sort((a, b) => {
    const fa = a.frontmatter
    const fb = b.frontmatter
    if (fa.pinned !== fb.pinned) return fa.pinned ? -1 : 1
    const soa = fa.sort_order
    const sob = fb.sort_order
    if (soa != null || sob != null) {
      if (soa == null) return 1
      if (sob == null) return -1
      if (soa !== sob) return soa - sob
    }
    let c = 0
    if (key === 'updated') c = (fb.updated_at || '').localeCompare(fa.updated_at || '')
    else if (key === 'status') c = (STATUS_ORDER[fa.status] ?? 9) - (STATUS_ORDER[fb.status] ?? 9)
    else if (key === 'company') c = fa.company.localeCompare(fb.company, 'ja')
    if (c !== 0) return c
    return fa.name.localeCompare(fb.name, 'ja')
  })
}

export default function AppHubHome(): React.JSX.Element {
  const { apps, isLoading, hasLoadedOnce, loadErrors, load, pathStatus, registryRoot } =
    useAppHubStore()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [detailSlug, setDetailSlug] = useState<string | null>(null)
  const [showDetect, setShowDetect] = useState(false)
  const detailApp = apps.find((a) => a.frontmatter.slug === detailSlug) ?? null

  useEffect(() => {
    if (!hasLoadedOnce) {
      void load()
    }
  }, [hasLoadedOnce, load])

  // 絞り込み用の選択肢(会社・グループ)は登録データから重複なしで作る。
  const companies = useMemo(
    () =>
      [...new Set(apps.map((a) => a.frontmatter.company).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'ja')
      ),
    [apps]
  )
  const groups = useMemo(
    () =>
      [...new Set(apps.map((a) => a.frontmatter.project_group).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'ja')
      ),
    [apps]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = apps.filter((app) => {
      const fm = app.frontmatter
      if (statusFilter !== 'all' && fm.status !== statusFilter) return false
      if (companyFilter !== 'all' && fm.company !== companyFilter) return false
      if (groupFilter !== 'all' && fm.project_group !== groupFilter) return false
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
    return sortApps(matched, sortKey)
  }, [apps, query, statusFilter, companyFilter, groupFilter, sortKey])

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDetect(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-secondary/60"
          >
            <ScanSearch size={14} />
            自動検出
          </button>
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem] max-w-sm">
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
        {companies.length > 0 && (
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-2 py-1.5 text-sm rounded-md border border-border bg-background"
          >
            <option value="all">すべての会社</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {groups.length > 0 && (
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-2 py-1.5 text-sm rounded-md border border-border bg-background"
          >
            <option value="all">すべてのグループ</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="px-2 py-1.5 text-sm rounded-md border border-border bg-background"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
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
              record={app}
              registryRoot={registryRoot}
              runAction={runAction}
              pathStatus={pathStatus[app.frontmatter.slug] ?? 'unknown'}
              onOpenDetail={() => setDetailSlug(app.frontmatter.slug)}
            />
          ))}
        </div>
      )}

      <AppDetailModal
        record={detailApp}
        onClose={() => setDetailSlug(null)}
        runAction={runAction}
      />

      <AppDetectModal
        open={showDetect}
        apps={apps}
        onClose={() => setShowDetect(false)}
        runAction={runAction}
      />
    </div>
  )
}

/**
 * 自動検出モーダル。既定の走査フォルダを調べ、package.jsonを持つのに台帳未登録の
 * プロジェクトを一覧表示する。台帳への登録自体はアプリ台帳ハブ側の役割なので、
 * ここでは「フォルダ/VS Codeを開く」導線までに留める。
 */
function AppDetectModal({
  open,
  apps,
  onClose,
  runAction
}: {
  open: boolean
  apps: AppRecord[]
  onClose: () => void
  runAction: (
    label: string,
    action: () => Promise<{ ok: boolean; message: string }>
  ) => Promise<void>
}): React.JSX.Element {
  const [isScanning, setIsScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [candidates, setCandidates] = useState<DetectedCandidate[]>([])

  useEffect(() => {
    if (!open) return
    let live = true
    setIsScanning(true)
    setHasScanned(false)
    const registered = apps.map((a) => a.frontmatter.paths.local)
    void detectUnregisteredApps(DEFAULT_SCAN_ROOTS, registered)
      .then((found) => {
        if (!live) return
        setCandidates(found)
      })
      .finally(() => {
        if (!live) return
        setIsScanning(false)
        setHasScanned(true)
      })
    return () => {
      live = false
    }
  }, [open, apps])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>アプリの自動検出</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            既定のフォルダを調べ、package.json
            があるのに台帳へ未登録のプロジェクトを一覧します。台帳への登録はアプリ台帳ハブ側で行ってください。
          </p>

          {isScanning && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw size={14} className="animate-spin" />
              走査中...
            </div>
          )}

          {!isScanning && hasScanned && candidates.length === 0 && (
            <div className="text-muted-foreground">
              未登録のプロジェクトは見つかりませんでした。
            </div>
          )}

          {!isScanning && candidates.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {candidates.length}件の未登録プロジェクト
              </div>
              {candidates.map((c) => (
                <div key={c.path} className="border border-border rounded-md p-2.5 space-y-1.5">
                  <div className="font-medium">
                    {c.packageName ?? c.dirName}
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      slug候補: {c.suggestedSlug}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate" title={c.path}>
                    {c.path}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => void runAction('フォルダを開く', () => openFolder(c.path))}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60"
                    >
                      <FolderOpen size={12} />
                      フォルダ
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAction('VS Codeで開く', () => openInVSCode(c.path))}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60"
                    >
                      VS Code
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const PROCESS_STATUS_LABEL: Record<string, string> = {
  stopped: '停止中',
  starting: '起動中…',
  running: '稼働中',
  error: 'エラー'
}
const PROCESS_STATUS_CLASS: Record<string, string> = {
  stopped: 'bg-neutral-500/15 text-neutral-400',
  starting: 'bg-amber-500/15 text-amber-500',
  running: 'bg-emerald-500/15 text-emerald-500',
  error: 'bg-red-500/15 text-red-500'
}

function AppCard({
  record,
  registryRoot,
  runAction,
  pathStatus,
  onOpenDetail
}: {
  record: AppRecord
  registryRoot: string
  runAction: (
    label: string,
    action: () => Promise<{ ok: boolean; message: string }>
  ) => Promise<void>
  pathStatus: PathStatus
  onOpenDetail: () => void
}): React.JSX.Element {
  const fm = record.frontmatter
  const overview = extractOverviewExcerpt(record.body)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    const thumbnail = fm.thumbnail?.trim()
    if (!thumbnail) {
      setThumbUrl(null)
      return
    }
    let live = true
    void loadThumbnailDataUrl(resolveThumbnailPath(registryRoot, thumbnail)).then((url) => {
      if (live) setThumbUrl(url)
    })
    return () => {
      live = false
    }
  }, [fm.thumbnail, registryRoot])
  const navigate = useNavigate()
  const primaryUrl = fm.urls.production ?? fm.urls.admin ?? null
  const devCommand = fm.launch?.dev_command?.trim() || ''
  const process = useAppHubProcessStore((s) => s.processes[fm.slug])
  const startProcess = useAppHubProcessStore((s) => s.start)
  const stopProcess = useAppHubProcessStore((s) => s.stop)
  const [showLogs, setShowLogs] = useState(false)
  const status = process?.status ?? 'stopped'
  const pathMissing = pathStatus === 'missing'
  const cautionSummary = summarizeCautions(fm.cautions)
  const openTodoCount = countOpenTodos(fm.todos)

  return (
    <div className="border border-border rounded-lg p-4 space-y-2.5 bg-card">
      {thumbUrl && (
        <img
          src={thumbUrl}
          alt={`${fm.name} のスクリーンショット`}
          className="w-full h-32 object-cover rounded-md border border-border/60 bg-secondary/40"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1 font-semibold text-sm">
            {fm.pinned && <Pin size={12} className="shrink-0 text-primary" fill="currentColor" />}
            <span className="truncate">{fm.name}</span>
          </div>
          <div className="text-xs text-muted-foreground">{KIND_LABEL[fm.kind]}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {cautionSummary.high > 0 && (
            <span
              title={`重大な注意事項 ${cautionSummary.high}件`}
              className="flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-500"
            >
              <AlertTriangle size={10} />
              {cautionSummary.high}
            </span>
          )}
          {cautionSummary.medium > 0 && (
            <span
              title={`注意事項 ${cautionSummary.medium}件`}
              className="flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500"
            >
              <AlertTriangle size={10} />
              {cautionSummary.medium}
            </span>
          )}
          {openTodoCount > 0 && (
            <span
              title={`残作業 ${openTodoCount}件`}
              className="flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-500"
            >
              <ListTodo size={10} />
              {openTodoCount}
            </span>
          )}
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded ${STATUS_BADGE_CLASS[fm.status] ?? ''}`}
          >
            {STATUS_LABEL[fm.status]}
          </span>
        </div>
      </div>

      {pathMissing && (
        <div className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/30 rounded p-1.5 flex items-start gap-1">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>
            登録されたフォルダが見つかりません。移動または削除された可能性があります。アプリ台帳ハブ側でパスを更新してください。
          </span>
        </div>
      )}

      {overview && <p className="text-xs text-muted-foreground line-clamp-2">{overview}</p>}

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
          onClick={onOpenDetail}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60"
        >
          <Info size={12} />
          詳細
        </button>
        <button
          type="button"
          onClick={() => void runAction('フォルダを開く', () => openFolder(fm.paths.local))}
          disabled={pathMissing}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <FolderOpen size={12} />
          フォルダ
        </button>
        <button
          type="button"
          onClick={() => void runAction('VS Codeで開く', () => openInVSCode(fm.paths.local))}
          disabled={pathMissing}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          VS Code
        </button>
        <button
          type="button"
          onClick={() =>
            void runAction('Claude Codeを開く', () => openClaudeTerminal(fm.paths.local))
          }
          disabled={pathMissing}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60 disabled:opacity-40 disabled:hover:bg-transparent"
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
        {primaryUrl && (
          <button
            type="button"
            onClick={() => {
              const result = previewAppUrl(primaryUrl)
              if (result.ok) navigate('/')
              else toast.error(`プレビューを開けませんでした: ${result.message}`)
            }}
            title="termul内の埋め込みブラウザで開く"
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60"
          >
            <Eye size={12} />
            プレビュー
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

      {devCommand && (
        <div className="pt-1.5 border-t border-border/60 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] px-1.5 py-0.5 rounded ${PROCESS_STATUS_CLASS[status]}`}>
              devサーバー: {PROCESS_STATUS_LABEL[status]}
            </span>
            {status === 'running' || status === 'starting' ? (
              <button
                type="button"
                onClick={() => void stopProcess(fm.slug)}
                disabled={status === 'starting'}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60 disabled:opacity-50"
              >
                <Square size={10} />
                停止
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startProcess(fm.slug, devCommand, fm.paths.local)}
                disabled={pathMissing}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Play size={10} />
                起動
              </button>
            )}
            {process && process.logs.length > 0 && (
              <button
                type="button"
                onClick={() => setShowLogs((v) => !v)}
                className="flex items-center gap-0.5 px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                ログ
                {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
          {process?.lastError && (
            <div className="text-[11px] text-red-500">{process.lastError}</div>
          )}
          {showLogs && process && process.logs.length > 0 && (
            <pre className="text-[10px] leading-tight bg-black/40 text-neutral-300 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {process.logs.slice(-60).join('\n')}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

const URL_FIELDS: Array<{ key: keyof AppFrontmatter['urls']; label: string }> = [
  { key: 'production', label: '本番' },
  { key: 'admin', label: '管理画面' },
  { key: 'github', label: 'GitHub' },
  { key: 'vercel', label: 'Vercel' },
  { key: 'supabase_dashboard', label: 'Supabaseダッシュボード' }
]

/** cautions配列は台帳側の過去データ形式ゆれを許容するため型を緩めている。
 *  表示時に {text, severity} の形をしている項目だけを安全に取り出す。 */
function readCaution(item: unknown): { text: string; severity: string } | null {
  if (typeof item !== 'object' || item === null) return null
  const record = item as Record<string, unknown>
  if (typeof record.text !== 'string') return null
  return {
    text: record.text,
    severity: typeof record.severity === 'string' ? record.severity : 'medium'
  }
}

const CAUTION_SEVERITY_CLASS: Record<string, string> = {
  high: 'text-red-500 bg-red-500/10 border-red-500/30',
  medium: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  low: 'text-muted-foreground bg-secondary/50 border-border'
}

function summarizeCautions(items: unknown[]): { high: number; medium: number; low: number } {
  const cautions = items.map(readCaution).filter((c) => c !== null)
  return {
    high: cautions.filter((c) => c.severity === 'high').length,
    medium: cautions.filter((c) => c.severity !== 'high' && c.severity !== 'low').length,
    low: cautions.filter((c) => c.severity === 'low').length
  }
}

/** todos配列も cautions と同じ理由(台帳側の形式ゆれ)で型を緩めている。
 *  表示時に {text, done} の形をしている項目だけを安全に取り出す。 */
function readTodo(item: unknown): { text: string; done: boolean } | null {
  if (typeof item !== 'object' || item === null) return null
  const record = item as Record<string, unknown>
  if (typeof record.text !== 'string') return null
  return { text: record.text, done: record.done === true }
}

function countOpenTodos(items: unknown[]): number {
  return items.map(readTodo).filter((t) => t !== null && !t.done).length
}

function AppDetailModal({
  record,
  onClose,
  runAction
}: {
  record: AppRecord | null
  onClose: () => void
  runAction: (
    label: string,
    action: () => Promise<{ ok: boolean; message: string }>
  ) => Promise<void>
}): React.JSX.Element {
  const fm = record?.frontmatter
  const overview = record ? (extractSection(record.body, '概要') ?? record.body) : ''
  const cautions = (fm?.cautions ?? []).map(readCaution).filter((c) => c !== null)
  const todos = (fm?.todos ?? []).map(readTodo).filter((t) => t !== null)

  return (
    <Dialog open={record !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {fm && (
          <>
            <DialogHeader>
              <DialogTitle>{fm.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded ${STATUS_BADGE_CLASS[fm.status] ?? ''}`}
                >
                  {STATUS_LABEL[fm.status]}
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                  {KIND_LABEL[fm.kind]}
                </span>
                {fm.company && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {fm.company}
                  </span>
                )}
                {fm.project_group && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {fm.project_group}
                  </span>
                )}
              </div>

              {overview && (
                <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                  {overview}
                </p>
              )}

              {(fm.tags.length > 0 || fm.tech_stack.length > 0) && (
                <div className="space-y-1">
                  {fm.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {fm.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {fm.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {fm.tech_stack.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">保存場所</div>
                <div className="text-xs font-mono break-all">{fm.paths.local}</div>
              </div>

              {URL_FIELDS.some(({ key }) => fm.urls[key]) && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">関連リンク</div>
                  <div className="space-y-1">
                    {URL_FIELDS.filter(({ key }) => fm.urls[key]).map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className="text-xs truncate">{fm.urls[key]}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(`${label}を開く`, () =>
                              openAppUrl(fm.urls[key] as string)
                            )
                          }
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-secondary/60 shrink-0"
                        >
                          <ExternalLink size={11} />
                          開く
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cautions.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">注意事項</div>
                  <div className="space-y-1">
                    {cautions.map((c, i) => (
                      <div
                        key={`${c.text}-${i}`}
                        className={`text-xs rounded border p-1.5 ${CAUTION_SEVERITY_CLASS[c.severity] ?? CAUTION_SEVERITY_CLASS.medium}`}
                      >
                        {c.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {todos.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">残作業</div>
                  <div className="space-y-1">
                    {todos.map((t, i) => (
                      <div
                        key={`${t.text}-${i}`}
                        className={`flex items-center gap-1.5 text-xs rounded border p-1.5 ${
                          t.done
                            ? 'text-muted-foreground bg-secondary/30 border-border line-through'
                            : 'text-sky-500 bg-sky-500/10 border-sky-500/30'
                        }`}
                      >
                        {t.done ? <CheckSquare size={12} /> : <ListTodo size={12} />}
                        {t.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
