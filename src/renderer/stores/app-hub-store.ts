import type { AppRecord } from '@shared/types/app-hub.types'
import { create } from 'zustand'
import { DEFAULT_REGISTRY_ROOT, loadAppRegistry } from '@/lib/app-hub-registry'
import { filesystemApi } from '@/lib/filesystem-api'

export type PathStatus = 'unknown' | 'checking' | 'exists' | 'missing'

interface AppHubState {
  apps: AppRecord[]
  registryRoot: string
  isLoading: boolean
  loadErrors: Array<{ file: string; message: string }>
  hasLoadedOnce: boolean
  /** slug -> 登録フォルダ(paths.local)が実際に存在するか。アプリを移動・削除した後の
   *  「登録は残っているのに開けない」を画面上で気づけるようにするための状態。 */
  pathStatus: Record<string, PathStatus>
  load: () => Promise<void>
  checkPaths: () => Promise<void>
}

export const useAppHubStore = create<AppHubState>((set, get) => ({
  apps: [],
  registryRoot: DEFAULT_REGISTRY_ROOT,
  isLoading: false,
  loadErrors: [],
  hasLoadedOnce: false,
  pathStatus: {},

  load: async () => {
    if (get().isLoading) return
    set({ isLoading: true })
    const { apps, errors } = await loadAppRegistry(get().registryRoot)
    set({ apps, loadErrors: errors, isLoading: false, hasLoadedOnce: true })
    void get().checkPaths()
  },

  checkPaths: async () => {
    const apps = get().apps
    set((s) => ({
      pathStatus: {
        ...s.pathStatus,
        ...Object.fromEntries(apps.map((a) => [a.frontmatter.slug, 'checking' as const]))
      }
    }))
    await Promise.all(
      apps.map(async (app) => {
        const slug = app.frontmatter.slug
        const localPath = app.frontmatter.paths.local
        const result = await filesystemApi.getFileInfo(localPath)
        set((s) => ({
          pathStatus: { ...s.pathStatus, [slug]: result.success ? 'exists' : 'missing' }
        }))
      })
    )
  }
}))
