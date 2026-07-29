/**
 * LIT App Hub: カード用サムネイル画像の読み込み。
 *
 * サムネイルはアプリ台帳ハブの registry/assets/ 配下に置き、frontmatter の
 * `thumbnail` にはレジストリルート(= registry/apps の親)からの相対パスを書く
 * (例: 'assets/craflow.png')。Termulは台帳フォルダに読み取り専用でアクセスするため、
 * 画像を @tauri-apps/plugin-fs の readFile(バイナリ)で読み、base64 の data URI に
 * して <img> で表示する。
 *
 * data URI を使う理由:
 *  - tauri.conf の CSP img-src は 'self'/asset:/data: を許可済み(data: が使える)。
 *  - fs:scope が C:/** を含むため台帳フォルダの画像を読める。
 *  - asset プロトコル(convertFileSrc)だと assetProtocol.scope の追加設定が要るが、
 *    こちらは fs:allow-read-file 権限の追加だけで済む。
 */
import { readFile } from '@tauri-apps/plugin-fs'

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml'
}

/**
 * レジストリルート(registry/apps)と frontmatter の thumbnail(相対パス)から、
 * 画像ファイルの絶対パスを組み立てる。thumbnail は registry/apps の「親」= registry を
 * 基準にした相対パス(例 'assets/craflow.png')として解釈する。
 * 既に絶対パス(C:\... や \\wsl$\...)が入っている場合はそのまま使う。
 */
export function resolveThumbnailPath(registryRoot: string, thumbnail: string): string {
  const trimmed = thumbnail.trim()
  // 絶対パス(ドライブレターまたはUNC)ならそのまま
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\')) {
    return trimmed
  }
  // registryRoot 末尾の \apps または /apps を取り除いて registry ルートにする
  const registryDir = registryRoot.replace(/[\\/]apps[\\/]?$/, '')
  const rel = trimmed.replace(/[\\/]+/g, '\\').replace(/^\\+/, '')
  return `${registryDir}\\${rel}`
}

function extensionOf(path: string): string {
  const idx = path.lastIndexOf('.')
  return idx >= 0 ? path.slice(idx + 1).toLowerCase() : ''
}

function base64FromBytes(bytes: Uint8Array): string {
  // btoa は「バイナリ文字列」を要求する。大きな配列を一度に String.fromCharCode へ
  // 渡すと引数展開でスタックを超えるため、チャンクに分けて連結する。
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/**
 * 絶対パスの画像を読み込み、data URI を返す。読めなければ null(カード側で非表示にする)。
 */
export async function loadThumbnailDataUrl(absPath: string): Promise<string | null> {
  try {
    const bytes = await readFile(absPath)
    if (!bytes || bytes.length === 0) return null
    const mime = MIME_BY_EXT[extensionOf(absPath)] ?? 'image/png'
    return `data:${mime};base64,${base64FromBytes(bytes)}`
  } catch {
    return null
  }
}
