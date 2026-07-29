/**
 * LIT App Hub: 一覧の表示設定(並び順・絞り込み)を永続化する(Phase 7-c)。
 *
 * 既存の設定と同じく @tauri-apps/plugin-store(termul-data.json、persistenceApi)へ保存する。
 * 検索文字列(query)は一時的なので保存しない。読み込み時は defaults とマージし、
 * 将来項目が増えても壊れないようにする(use-context-bar-settings.ts と同方式)。
 */
import { useCallback, useEffect, useState } from 'react'
import { persistenceApi } from '@/lib/api'

export type AppHubSortKey = 'name' | 'updated' | 'status' | 'company'

export interface AppHubSettings {
  statusFilter: string
  companyFilter: string
  groupFilter: string
  sortKey: AppHubSortKey
}

export const DEFAULT_APP_HUB_SETTINGS: AppHubSettings = {
  statusFilter: 'all',
  companyFilter: 'all',
  groupFilter: 'all',
  sortKey: 'name'
}

const APP_HUB_SETTINGS_KEY = 'settings/app-hub'

export function useAppHubSettings(): {
  settings: AppHubSettings
  updateSettings: (patch: Partial<AppHubSettings>) => void
} {
  const [settings, setSettings] = useState<AppHubSettings>(DEFAULT_APP_HUB_SETTINGS)

  useEffect(() => {
    let live = true
    void persistenceApi
      .read<AppHubSettings>(APP_HUB_SETTINGS_KEY)
      .then((result) => {
        if (live && result.success && result.data) {
          setSettings({ ...DEFAULT_APP_HUB_SETTINGS, ...result.data })
        }
      })
      .catch(() => {
        // 読めなければ既定のまま
      })
    return () => {
      live = false
    }
  }, [])

  const updateSettings = useCallback((patch: Partial<AppHubSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      void persistenceApi.writeDebounced(APP_HUB_SETTINGS_KEY, next)
      return next
    })
  }, [])

  return { settings, updateSettings }
}
