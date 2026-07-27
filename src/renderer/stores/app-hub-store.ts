import type { AppRecord } from '@shared/types/app-hub.types'
import { create } from 'zustand'
import { DEFAULT_REGISTRY_ROOT, loadAppRegistry } from '@/lib/app-hub-registry'

interface AppHubState {
  apps: AppRecord[]
  registryRoot: string
  isLoading: boolean
  loadErrors: Array<{ file: string; message: string }>
  hasLoadedOnce: boolean
  load: () => Promise<void>
}

export const useAppHubStore = create<AppHubState>((set, get) => ({
  apps: [],
  registryRoot: DEFAULT_REGISTRY_ROOT,
  isLoading: false,
  loadErrors: [],
  hasLoadedOnce: false,

  load: async () => {
    if (get().isLoading) return
    set({ isLoading: true })
    const { apps, errors } = await loadAppRegistry(get().registryRoot)
    set({ apps, loadErrors: errors, isLoading: false, hasLoadedOnce: true })
  }
}))
