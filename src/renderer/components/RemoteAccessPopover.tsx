import { AlertCircle, Check, Copy, ExternalLink, Monitor, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { useUpdateAppSetting } from '@/hooks/use-app-settings'
import { openerApi, remoteServerApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAppSettingsStore } from '@/stores/app-settings-store'
import { useRemoteStatus, useRemoteStatusStore } from '@/stores/remote-status-store'
import { REMOTE_BIND_MODE_OPTIONS, type RemoteBindMode } from '@/types/settings'

const statusBarTriggerClass =
  'flex items-center hover:bg-white/10 px-2 py-0.5 rounded cursor-pointer transition-colors'

export function RemoteAccessPopover(): React.JSX.Element {
  const remoteStatus = useRemoteStatus()
  const remoteBindMode = useAppSettingsStore((s) => s.settings.remoteBindMode)
  const updateSetting = useUpdateAppSetting()
  const [remoteBusy, setRemoteBusy] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  const isRunning = remoteStatus?.running ?? false
  const url = remoteStatus?.url ?? null

  const handleRemoteToggle = async (enable: boolean): Promise<void> => {
    setRemoteBusy(true)
    setRemoteError(null)
    setOpenError(null)
    try {
      const result = enable
        ? await remoteServerApi.start({ bindMode: remoteBindMode })
        : await remoteServerApi.stop()
      if (result.success) {
        useRemoteStatusStore.getState().setStatus(result.data)
      } else {
        setRemoteError(result.error)
      }
    } catch (error) {
      setRemoteError(error instanceof Error ? error.message : String(error))
    } finally {
      setRemoteBusy(false)
    }
  }

  const handleCopyRemote = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 1500)
    } catch {
      // Clipboard unavailable; ignore.
    }
  }

  const handleOpenInBrowser = async (): Promise<void> => {
    if (!url) return
    setOpenError(null)
    const result = await openerApi.openUrlWithSystemBrowser(url)
    if (!result.success) {
      const message = result.error ?? 'ブラウザでURLを開けませんでした'
      setOpenError(message)
      toast.error(message)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={statusBarTriggerClass}
          aria-label="リモートターミナルアクセス"
          aria-pressed={isRunning}
        >
          <Monitor size={14} className={cn('mr-0', isRunning ? 'text-green-300' : undefined)} />
          {isRunning && <span className="sr-only">リモートアクセス有効</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-96 p-4">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm text-foreground">リモートターミナルアクセス</h4>
            <p className="text-xs text-muted-foreground mt-1">
              HTTP・WebSocket経由で、Webブラウザから起動中のターミナルにアクセスできます。
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-foreground mb-2">
              リッスン先
            </label>
            <select
              value={remoteBindMode}
              onChange={(e) => updateSetting('remoteBindMode', e.target.value as RemoteBindMode)}
              disabled={isRunning}
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {REMOTE_BIND_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {REMOTE_BIND_MODE_OPTIONS.find((o) => o.value === remoteBindMode)?.description}
              {isRunning && <> バインドアドレスを変更するには、サーバーを停止してください。</>}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-foreground">リモートアクセスを有効化</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {remoteBindMode === 'all'
                  ? '0.0.0.0（すべてのネットワークインターフェース）でサーバーを起動します'
                  : '127.0.0.1（このマシンのみ）でサーバーを起動します'}
              </div>
            </div>
            <Switch
              checked={isRunning}
              disabled={remoteBusy}
              onCheckedChange={(checked) => void handleRemoteToggle(checked)}
              aria-label="リモートターミナルアクセスを切り替え"
            />
          </div>

          {remoteError && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{remoteError}</span>
            </div>
          )}

          {isRunning && url && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  このアドレスにアクセスできる人は誰でもこのマシンでコマンドを実行できます。認証トークンはなく、
                  同一オリジンのブラウザチェックのみが適用されます。{' '}
                  {remoteStatus?.bindMode === 'all' ? (
                    <>
                      サーバーは<strong>すべてのインターフェース</strong>
                      で待ち受けます。LAN上のデバイスは、このマシンのIPアドレスと下のポートを使って接続できます。
                    </>
                  ) : (
                    <>
                      サーバーは<strong>localhostのみ</strong>
                      で待ち受けます。他のデバイスからアクセスするには、トンネル（例:{' '}
                      <code className="text-2xs">cloudflared</code>
                      ）を使うか、「すべてのインターフェース」に 切り替えて再起動してください。
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">バインドホスト</div>
                  <div className="text-sm font-mono text-foreground bg-secondary/50 border border-border rounded-md px-3 py-2">
                    {remoteStatus?.bindHost ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">ポート</div>
                  <div className="text-sm font-mono text-foreground bg-secondary/50 border border-border rounded-md px-3 py-2">
                    {remoteStatus?.port ?? '—'}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">このマシンで開く</div>
                  <div className="text-sm font-mono text-foreground bg-secondary/50 border border-border rounded-md px-3 py-2 truncate">
                    {url.replace(/^https?:\/\//, '')}
                  </div>
                </div>
              </div>

              {remoteStatus?.bindMode === 'all' && (
                <p className="text-xs text-muted-foreground">
                  他のデバイスでは{' '}
                  <span className="font-mono">
                    http://&lt;this-machine-ip&gt;:{remoteStatus.port}
                  </span>{' '}
                  を開いてください（&lt;this-machine-ip&gt; はLAN IPに置き換え）。
                </p>
              )}

              <div>
                <div className="text-xs text-muted-foreground mb-1">ブラウザで開く</div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={url}
                    className="flex-1 min-w-0 text-sm font-mono text-foreground bg-secondary/50 border border-border rounded-md px-3 py-2 outline-none select-all"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={() => void handleCopyRemote(url)}
                    className="shrink-0 inline-flex items-center gap-1 text-sm bg-secondary hover:bg-secondary/80 border border-border rounded-md px-3 py-2 transition-colors"
                    aria-label="URLをコピー"
                  >
                    {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedUrl ? 'コピー済み' : 'コピー'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void handleOpenInBrowser()}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-2 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  ブラウザで開く
                </button>
                {openError && <p className="text-xs text-destructive mt-1">{openError}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  このURLをブラウザで開くと、プロジェクトとターミナルを確認できます。トークンは不要です。
                </p>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
