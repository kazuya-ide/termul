import { confirm } from '@tauri-apps/plugin-dialog'
import { Clock, Download, Terminal } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { hasActiveTerminalSessions } from '@/lib/tauri-safe-update'
import { isAurUpdateMode } from '@/lib/tauri-updater-api'
import {
  updaterStore,
  useDownloadProgress,
  useIsDownloading,
  useUpdateDownloaded,
  useUpdaterActions,
  useUpdaterState,
  useUpdateVersion
} from '@/stores/updater-store'

// Local storage keys
const UPDATE_REMINDER_KEY = 'update-reminder-timestamp'

/**
 * Check if the user has asked to be reminded tomorrow
 */
function shouldShowReminder(): boolean {
  const reminderTimestamp = localStorage.getItem(UPDATE_REMINDER_KEY)
  if (!reminderTimestamp) return true

  const reminderDate = new Date(reminderTimestamp)
  const now = new Date()
  const oneDayInMs = 24 * 60 * 60 * 1000

  return now.getTime() - reminderDate.getTime() >= oneDayInMs
}

/**
 * Set reminder for tomorrow
 */
function setReminderForTomorrow(): void {
  const now = new Date()
  localStorage.setItem(UPDATE_REMINDER_KEY, now.toISOString())
}

/**
 * Show a toast notification for available update
 */
export function showUpdateToast(version: string, releaseNotes?: string): void {
  const isAur = isAurUpdateMode()

  toast.success(`更新があります: バージョン ${version}`, {
    duration: 30000,
    description: releaseNotes
      ? `新機能:\n${releaseNotes.slice(0, 100)}${releaseNotes.length > 100 ? '...' : ''}`
      : isAur
        ? '新しいバージョンがあります。yay で更新してください。'
        : '新しいバージョンをダウンロードできます。',
    action: {
      label: (
        <div className="flex items-center gap-2">
          {isAur ? <Terminal size={14} /> : <Download size={14} />}
          <span>{isAur ? 'yay を使う' : 'ダウンロード'}</span>
        </div>
      ),
      onClick: async () => {
        if (isAur) {
          toast.info('ターミナルで実行', {
            description: 'yay -S termul-manager'
          })
          return
        }

        const { downloadUpdate } = updaterStore.getState()
        try {
          await downloadUpdate()
          const downloadError = updaterStore.getState().error
          if (downloadError) {
            toast.error('更新のダウンロードに失敗しました', {
              description: downloadError
            })
          }
        } catch (error) {
          toast.error('更新のダウンロードに失敗しました', {
            description:
              error instanceof Error
                ? error.message
                : 'ダウンロード中に予期しないエラーが発生しました'
          })
        }
      }
    },
    cancel: {
      label: (
        <div className="flex items-center gap-2">
          <Clock size={14} />
          <span>後で通知</span>
        </div>
      ),
      onClick: () => {
        setReminderForTomorrow()
      }
    }
  })
}

/**
 * Show a toast notification when update is downloaded
 */
export function showUpdateDownloadedToast(version: string): void {
  toast.success(`更新の準備ができました`, {
    duration: 30000,
    description: `バージョン ${version} のダウンロードが完了しました。今すぐインストールすると適用されます — アプリが再起動し、実行中のターミナルセッションはすべて終了します。`,
    action: {
      label: (
        <div className="flex items-center gap-2">
          <Download size={14} />
          <span>インストールして再起動</span>
        </div>
      ),
      onClick: async () => {
        try {
          const hasActiveTerminals = hasActiveTerminalSessions()
          const confirmed = await confirm(
            hasActiveTerminals
              ? `Termul はバージョン ${version} をインストールして再起動します。実行中のターミナルセッションは終了します。続けますか？`
              : `Termul はバージョン ${version} をインストールしてすぐに再起動します。続けますか？`,
            {
              title: '更新をインストール',
              kind: 'warning',
              okLabel: 'インストールして再起動',
              cancelLabel: '後で'
            }
          )
          if (!confirmed) return

          const { installAndRestart } = updaterStore.getState()
          await installAndRestart()
          const installError = updaterStore.getState().error
          if (installError) {
            toast.error('更新のインストールに失敗しました', {
              description: installError
            })
          }
        } catch (error) {
          toast.error('更新のインストールに失敗しました', {
            description:
              error instanceof Error
                ? error.message
                : 'インストール中に予期しないエラーが発生しました'
          })
        }
      }
    }
  })
}

/**
 * Show a toast notification with download progress
 */
function showDownloadProgressToast(version: string, progress: number): void {
  const progressId = `download-progress-${version}`

  toast.loading(`バージョン ${version} をダウンロード中...`, {
    id: progressId,
    description: `${progress.toFixed(0)}% 完了`,
    duration: Infinity
  })
}

/**
 * Dismiss download progress toast
 */
function dismissDownloadProgressToast(version: string): void {
  const progressId = `download-progress-${version}`
  toast.dismiss(progressId)
}

/**
 * Hook to manage update toast notifications
 * Listens to updater state changes and shows appropriate toasts
 */
export function useUpdateToast(): void {
  const { updateAvailable, downloaded, isDownloading, skippedVersion } = useUpdaterState()
  const version = useUpdateVersion()
  const _updateDownloaded = useUpdateDownloaded()
  const downloading = useIsDownloading()
  const downloadProgress = useDownloadProgress()

  // Track if we've already shown a toast for the current update
  const hasShownAvailableToast = useRef(false)
  const hasShownDownloadedToast = useRef(false)

  // Show toast when update becomes available
  useEffect(() => {
    if (
      updateAvailable &&
      version &&
      !downloaded &&
      !hasShownAvailableToast.current &&
      !downloading &&
      shouldShowReminder() &&
      skippedVersion !== version
    ) {
      showUpdateToast(version)
      hasShownAvailableToast.current = true
    }
  }, [updateAvailable, version, downloaded, downloading, skippedVersion])

  // Show toast when update is downloaded and ready to install
  useEffect(() => {
    if (downloaded && version && !hasShownDownloadedToast.current) {
      showUpdateDownloadedToast(version)
      hasShownDownloadedToast.current = true
    }
  }, [downloaded, version])

  // Show download progress
  useEffect(() => {
    if (isDownloading && version) {
      showDownloadProgressToast(version, downloadProgress)

      // Clean up progress toast when download completes or effect re-runs
      return () => {
        dismissDownloadProgressToast(version)
      }
    }
  }, [isDownloading, downloadProgress, version])

  // Reset flags when update state changes
  useEffect(() => {
    if (!updateAvailable) {
      hasShownAvailableToast.current = false
      hasShownDownloadedToast.current = false
    }
  }, [updateAvailable])
}

/**
 * Hook to manually trigger update toasts with options
 */
export function useManualUpdateToast() {
  const { updateAvailable, version, downloaded } = useUpdaterState()
  const { skipVersion } = useUpdaterActions()

  const showAvailable = () => {
    if (version) {
      showUpdateToast(version)
    }
  }

  const showDownloaded = () => {
    if (version) {
      showUpdateDownloadedToast(version)
    }
  }

  const skip = () => {
    if (version) {
      skipVersion(version)
      toast.info(`バージョン ${version} をスキップしました`, {
        description: 'このバージョンについては今後通知されません。'
      })
    }
  }

  const remindTomorrow = () => {
    setReminderForTomorrow()
    toast.info('リマインダーを設定しました', {
      description: '明日、更新についてお知らせします。'
    })
  }

  return {
    showAvailable,
    showDownloaded,
    skip,
    remindTomorrow,
    canShow: updateAvailable && version !== null,
    isReady: downloaded
  }
}
