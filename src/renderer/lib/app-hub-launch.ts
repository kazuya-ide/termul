/**
 * LIT App Hub: 外部アプリ起動アクション。
 *
 * 実行ファイルと引数を分離し(シェル文字列結合をしない)、@tauri-apps/plugin-shell の
 * Command.create() で安全に起動する。アプリ台帳ハブ側(src/lib/actions/launch.ts、
 * cross-spawn使用)と同じ安全設計を踏襲している。
 */
import { Command } from '@tauri-apps/plugin-shell'
import { openerApi } from '@/lib/tauri-opener-api'

export interface LaunchResult {
  ok: boolean
  message: string
}

/** すぐ終わる起動コマンド用。プロセスは切り離して起動確認のみ行う。 */
async function spawnDetached(program: string, args: string[]): Promise<LaunchResult> {
  try {
    const command = Command.create(program, args)
    await command.spawn()
    return { ok: true, message: '' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

export async function openFolder(localPath: string): Promise<LaunchResult> {
  const result = await openerApi.revealInFileManager(localPath)
  return result.success
    ? { ok: true, message: 'フォルダを開きました' }
    : { ok: false, message: `フォルダを開けませんでした: ${result.error}` }
}

export async function openInVSCode(localPath: string): Promise<LaunchResult> {
  const result = await spawnDetached('code', [localPath])
  return result.ok
    ? { ok: true, message: 'VS Codeを起動しました' }
    : { ok: false, message: `VS Code起動に失敗しました: ${result.message}` }
}

function isWslPath(p: string): boolean {
  return p.startsWith('\\\\wsl$') || p.startsWith('\\\\wsl.localhost')
}

export async function openClaudeTerminal(localPath: string): Promise<LaunchResult> {
  if (isWslPath(localPath)) {
    const match = localPath.match(/^\\\\wsl(?:\.localhost)?\$\\([^\\]+)\\(.*)$/)
    if (match) {
      const [, distro, rest] = match
      const wslPath = `/${rest.replace(/\\/g, '/')}`
      const result = await spawnDetached('wt.exe', [
        '-d',
        localPath,
        '--',
        'wsl',
        '-d',
        distro,
        '--cd',
        wslPath,
        'claude'
      ])
      return result.ok
        ? { ok: true, message: 'Windows TerminalでClaude Codeを起動しました(WSL)' }
        : { ok: false, message: `Claude Code起動に失敗しました: ${result.message}` }
    }
  }
  const result = await spawnDetached('wt.exe', ['-d', localPath, '--', 'claude'])
  return result.ok
    ? { ok: true, message: 'Windows TerminalでClaude Codeを起動しました' }
    : { ok: false, message: `Claude Code起動に失敗しました: ${result.message}` }
}

export async function openAppUrl(url: string): Promise<LaunchResult> {
  const result = await openerApi.openUrlWithSystemBrowser(url)
  return result.success
    ? { ok: true, message: 'URLを開きました' }
    : { ok: false, message: `URLを開けませんでした: ${result.error}` }
}

/** アプリ台帳ハブ側の safe_commands(id/label/command/args/cwd)をそのまま実行する。 */
export async function runSafeCommand(
  command: string,
  args: string[],
  cwd?: string
): Promise<LaunchResult> {
  try {
    const cmd = Command.create(command, args, cwd ? { cwd } : undefined)
    const child = await cmd.spawn()
    return { ok: true, message: `${command} ${args.join(' ')} を起動しました(PID ${child.pid})` }
  } catch (err) {
    return {
      ok: false,
      message: `コマンド実行に失敗しました: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}
