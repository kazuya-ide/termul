/**
 * LIT App Hub: アプリ台帳ハブの registry/apps/*.md を読み込む。
 *
 * 台帳データはTermul側に複製しない。アプリ台帳ハブ(別の常設Next.jsアプリ)が
 * 書き込んだ .md ファイルを、Termulからは読み取り専用で参照する。
 * 台帳の作成・編集はアプリ台帳ハブ側のUIで行う想定(役割分担)。
 */

import {
  type AppFrontmatter,
  type AppRecord,
  appFrontmatterSchema
} from '@shared/types/app-hub.types'
import { load as parseYaml } from 'js-yaml'
import { filesystemApi } from '@/lib/filesystem-api'

/** アプリ台帳ハブのインストール場所。設定画面で変更可能にする想定(現状は固定値)。 */
export const DEFAULT_REGISTRY_ROOT = 'C:\\Users\\Owner\\Desktop\\アプリ台帳ハブ\\registry\\apps'

export interface LoadRegistryResult {
  apps: AppRecord[]
  /** 読み込みはできたがスキーマ不正だった等でスキップしたファイル */
  errors: Array<{ file: string; message: string }>
}

// gray-matter は Node.js の Buffer 前提で実装されており、Tauriのレンダラー
// (Node.jsではなくブラウザ相当の実行環境)では "Buffer is not defined" で
// 例外になる。frontmatter形式("---"で囲まれたYAML)は単純なので、
// js-yaml(ブラウザ安全・Node API非依存)で自前パースする。
function splitFrontmatter(raw: string): { data: unknown; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { data: {}, content: raw }
  }
  const [, yamlBlock, body] = match
  const data = parseYaml(yamlBlock)
  return { data, content: body }
}

function normalizeMarkdownFrontmatter(raw: unknown): AppFrontmatter {
  return appFrontmatterSchema.parse(raw)
}

export async function loadAppRegistry(
  registryRoot: string = DEFAULT_REGISTRY_ROOT
): Promise<LoadRegistryResult> {
  const dirResult = await filesystemApi.readDirectory(registryRoot)
  if (!dirResult.success) {
    return { apps: [], errors: [{ file: registryRoot, message: dirResult.error }] }
  }

  const mdFiles = dirResult.data.filter((e) => e.type === 'file' && e.name.endsWith('.md'))
  const apps: AppRecord[] = []
  const errors: Array<{ file: string; message: string }> = []

  for (const entry of mdFiles) {
    const fileResult = await filesystemApi.readFile(entry.path)
    if (!fileResult.success) {
      errors.push({ file: entry.name, message: fileResult.error })
      continue
    }
    try {
      const parsed = splitFrontmatter(fileResult.data.content)
      const frontmatter = normalizeMarkdownFrontmatter(parsed.data)
      apps.push({ frontmatter, body: parsed.content.trim(), filePath: entry.path })
    } catch (err) {
      errors.push({ file: entry.name, message: err instanceof Error ? err.message : String(err) })
    }
  }

  apps.sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name, 'ja'))
  return { apps, errors }
}
