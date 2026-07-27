/**
 * LIT App Hub: 外部アプリ起動アクション。
 *
 * 実行ファイルと引数を分離し(シェル文字列結合をしない)、@tauri-apps/plugin-shell の
 * Command.create() で起動する。
 *
 * Windows固有の注意点(実機検証で判明): `code`(VS Code)は`code.cmd`、`npm`や
 * `claude`(Claude Code CLI)は環境によって`.ps1`として配布されており、
 * Command.create(program, args) で直接起動すると「指定されたファイルが見つかりません」
 * で失敗する(Win32のCreateProcessは.cmd/.ps1の拡張子解決をしないため)。
 * PowerShellの呼び出し演算子(&)経由で起動することで、.exe/.cmd/.ps1いずれも
 * 解決できるようにする。引数は個別にシングルクォートでエスケープして渡すため、
 * シェルメタ文字による注入は起きない(値をそのままコマンドラインへ結合しない)。
 */
import { Command } from '@tauri-apps/plugin-shell'
import { openerApi } from '@/lib/tauri-opener-api'

export interface LaunchResult {
  ok: boolean
  message: string
}

/** PowerShellのシングルクォート文字列として安全な形にする(内部の ' は '' に)。 */
export function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * `& 'program' 'arg1' 'arg2' ...` 形式のPowerShell呼び出し文字列を組み立てる。
 * 値をそのまま結合するのではなく、要素ごとにクォートしてから並べるだけなので、
 * 値の中にシェル制御文字が入っていても注入は起きない。
 */
export function buildPowerShellInvocation(program: string, args: string[]): string {
  return `& ${[program, ...args].map(psQuote).join(' ')}`
}

/**
 * Windows上で任意の実行ファイル(.exe/.cmd/.ps1のいずれでも)をPowerShell経由で
 * 安全に起動する。programとargsはそれぞれ個別にクォートしてから渡すので、
 * 値自体にシェル制御文字が含まれていても、それは「ただの文字列」として扱われる
 * (コマンド結合・シェル注入は発生しない)。
 */
export async function spawnViaPowerShell(
  program: string,
  args: string[],
  options?: { cwd?: string }
): Promise<LaunchResult> {
  try {
    const invocation = buildPowerShellInvocation(program, args)
    const command = Command.create(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', invocation],
      options?.cwd ? { cwd: options.cwd } : undefined
    )
    await command.spawn()
    return { ok: true, message: '' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

/** ウィンドウを新しく開くだけの起動コマンド用(wt.exe等、実体が.exeのもの)。 */
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
  const result = await spawnViaPowerShell('code', [localPath])
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
  // claude はWindows上では .ps1 で配布されているため、wt.exe単体からは直接
  // 解決できない(実機検証で確認)。PowerShellを明示的に挟み、終了後も
  // ウィンドウが閉じないよう -NoExit を付ける。
  const result = await spawnDetached('wt.exe', [
    '-d',
    localPath,
    '--',
    'powershell',
    '-NoExit',
    '-Command',
    'claude'
  ])
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
  const result = await spawnViaPowerShell(command, args, cwd ? { cwd } : undefined)
  return result.ok
    ? { ok: true, message: `${command} ${args.join(' ')} を起動しました` }
    : { ok: false, message: `コマンド実行に失敗しました: ${result.message}` }
}
