import { Command } from '@tauri-apps/plugin-shell'
import { create } from 'zustand'
import { buildPowerShellInvocation } from '@/lib/app-hub-launch'

export type AppProcessStatus = 'stopped' | 'starting' | 'running' | 'error'

interface AppProcessRecord {
  status: AppProcessStatus
  pid?: number
  logs: string[]
  startedAt?: string
  lastError?: string
}

const MAX_LOG_LINES = 300

interface AppHubProcessState {
  processes: Record<string, AppProcessRecord>
  /** slug -> Tauri Child(実プロセスハンドル)。ストア外に保持し、Zustandのイミュータブル更新対象から外す。 */
  children: Map<string, Awaited<ReturnType<Command<string>['spawn']>>>
  start: (slug: string, devCommand: string, cwd: string) => Promise<void>
  stop: (slug: string) => Promise<void>
}

function appendLog(logs: string[], line: string): string[] {
  const next = [...logs, line]
  return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next
}

export const useAppHubProcessStore = create<AppHubProcessState>((set, get) => ({
  processes: {},
  children: new Map(),

  start: async (slug, devCommand, cwd) => {
    const existing = get().processes[slug]
    if (existing?.status === 'running' || existing?.status === 'starting') return

    const parts = devCommand.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) {
      set((s) => ({
        processes: {
          ...s.processes,
          [slug]: { status: 'error', logs: [], lastError: '起動コマンドが登録されていません' }
        }
      }))
      return
    }
    const [program, ...args] = parts

    set((s) => ({
      processes: { ...s.processes, [slug]: { status: 'starting', logs: [] } }
    }))

    try {
      // npm/code等はWindows上で.cmd/.ps1として配布されており、直接起動すると
      // 解決に失敗する(実機検証で確認)。PowerShell経由で安全に起動する
      // (app-hub-launch.tsのspawnViaPowerShellと同じ方式)。
      const invocation = buildPowerShellInvocation(program, args)
      const command = Command.create(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command', invocation],
        { cwd }
      )
      command.stdout.on('data', (line) => {
        set((s) => {
          const rec = s.processes[slug]
          if (!rec) return s
          return {
            processes: { ...s.processes, [slug]: { ...rec, logs: appendLog(rec.logs, line) } }
          }
        })
      })
      command.stderr.on('data', (line) => {
        set((s) => {
          const rec = s.processes[slug]
          if (!rec) return s
          return {
            processes: { ...s.processes, [slug]: { ...rec, logs: appendLog(rec.logs, line) } }
          }
        })
      })
      command.on('close', (data) => {
        get().children.delete(slug)
        set((s) => {
          const rec = s.processes[slug]
          if (!rec) return s
          return {
            processes: {
              ...s.processes,
              [slug]: {
                ...rec,
                status: 'stopped',
                logs: appendLog(rec.logs, `[終了] コード ${data.code ?? 'unknown'}`)
              }
            }
          }
        })
      })
      command.on('error', (error) => {
        get().children.delete(slug)
        set((s) => {
          const rec = s.processes[slug]
          if (!rec) return s
          return {
            processes: {
              ...s.processes,
              [slug]: { ...rec, status: 'error', lastError: String(error) }
            }
          }
        })
      })

      const child = await command.spawn()
      get().children.set(slug, child)
      set((s) => ({
        processes: {
          ...s.processes,
          [slug]: {
            status: 'running',
            pid: child.pid,
            logs: [`起動しました: ${program} ${args.join(' ')} (PID ${child.pid})`],
            startedAt: new Date().toISOString()
          }
        }
      }))
    } catch (err) {
      set((s) => ({
        processes: {
          ...s.processes,
          [slug]: {
            status: 'error',
            logs: [],
            lastError: err instanceof Error ? err.message : String(err)
          }
        }
      }))
    }
  },

  stop: async (slug) => {
    const child = get().children.get(slug)
    if (!child) return
    try {
      // PowerShell経由で起動しているため、child.kill()はラッパーの
      // powershell.exeしか止められず、その下でnpm/nodeが孫プロセスとして
      // 残り続ける恐れがある。taskkill /T でプロセスツリーごと終了させる。
      await Command.create('taskkill', ['/T', '/F', '/PID', String(child.pid)]).execute()
    } finally {
      get().children.delete(slug)
      set((s) => {
        const rec = s.processes[slug]
        if (!rec) return s
        return { processes: { ...s.processes, [slug]: { ...rec, status: 'stopped' } } }
      })
    }
  }
}))
