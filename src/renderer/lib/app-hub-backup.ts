/**
 * LIT App Hub: 台帳のバックアップ/エクスポート(Phase 7)。
 *
 * 台帳の実体は別アプリ(アプリ台帳ハブ)が管理する外部フォルダ registry/(配下に
 * apps/ と assets/)。Termul の appData とは別物なので、既存の appData 向け
 * Migration/backup 機構ではなく「外部 registry フォルダを直接コピー/書き出し」する。
 *
 * fs 権限(copy-file/mkdir/read-dir/write-text-file)と dialog(open/save)は
 * capabilities で許可済み。追加権限は不要。
 */

import type { AppRecord } from '@shared/types/app-hub.types'
import { open, save } from '@tauri-apps/plugin-dialog'
import { copyFile, mkdir, readDir, writeTextFile } from '@tauri-apps/plugin-fs'

export interface BackupResult {
  ok: boolean
  message: string
}

/** registryRoot(.../registry/apps)から親の registry フォルダ(apps と assets を含む)を求める。 */
function registryDirOf(registryRoot: string): string {
  return registryRoot.replace(/[\\/]apps[\\/]?$/, '')
}

/** ダイアログ用に : や . を含まない安全なタイムスタンプ文字列を作る。 */
function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

/**
 * 台帳の全アプリを1つのJSONへ書き出す(保存先はダイアログで選択)。
 * frontmatter と本文を含む。assets の画像ファイルそのものは含まない(内容のスナップショット)。
 */
export async function exportRegistryJson(apps: AppRecord[]): Promise<BackupResult> {
  try {
    const dest = await save({
      defaultPath: `app-registry-backup-${timestamp()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (!dest) return { ok: true, message: '' } // ユーザーがキャンセル
    const payload = {
      exportedAt: new Date().toISOString(),
      count: apps.length,
      apps: apps.map((a) => ({ ...a.frontmatter, _body: a.body }))
    }
    await writeTextFile(dest, JSON.stringify(payload, null, 2))
    return { ok: true, message: `${apps.length}件をJSONに書き出しました` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

/** src フォルダを dest へ再帰コピーする(plugin-fs の readDir はフラットなので手動再帰)。 */
async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  const entries = await readDir(src)
  for (const entry of entries) {
    const s = `${src}/${entry.name}`
    const d = `${dest}/${entry.name}`
    if (entry.isDirectory) await copyDir(s, d)
    else if (entry.isFile) await copyFile(s, d)
  }
}

/**
 * 台帳フォルダ(registry/ = apps/*.md と assets/ を含む)を、選んだ場所へ丸ごとコピーする。
 * 画像も含めた完全なバックアップになる。
 */
export async function backupRegistryFolder(registryRoot: string): Promise<BackupResult> {
  try {
    const destParent = await open({ directory: true, title: 'バックアップ先フォルダを選択' })
    if (!destParent || Array.isArray(destParent)) return { ok: true, message: '' } // キャンセル
    const src = registryDirOf(registryRoot)
    const dest = `${destParent}/registry-backup-${timestamp()}`
    await copyDir(src, dest)
    return { ok: true, message: `台帳フォルダをバックアップしました: ${dest}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}
