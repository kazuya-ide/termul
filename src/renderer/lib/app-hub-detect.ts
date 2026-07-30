/**
 * LIT App Hub: アプリ自動検出(Phase 6)。
 *
 * 指定フォルダ群を走査し、package.json を持つプロジェクトディレクトリのうち、
 * アプリ台帳(registry/apps/*.md の frontmatter.paths.local)に未登録のものを
 * 「候補」として返す。台帳への実際の登録は別アプリ(アプリ台帳ハブ)の役割なので、
 * ここでは検出=一覧化までを行い、UI側では「フォルダ/VS Codeを開く」等の導線に留める。
 *
 * 走査は @tauri-apps/plugin-fs 経由(filesystemApi)。既存の fs:scope が C:/** 等を
 * 許可しているため追加権限は不要。WSL の UNC パス(\\wsl$\...)はスコープ外のため
 * 既定の走査対象には含めない。
 */
import { filesystemApi } from '@/lib/filesystem-api'

/**
 * 既定の走査ルート。井手さんのプロジェクトが集まる場所(登録済み台帳の paths.local から実測)。
 * 将来的にユーザー設定で変更可能にする想定だが、現状は DEFAULT_REGISTRY_ROOT と同様に定数で持つ。
 */
export const DEFAULT_SCAN_ROOTS: string[] = [
  'C:\\Users\\Owner\\Desktop\\LITアプリ一覧',
  'C:\\Users\\Owner\\Desktop\\カンパニー_LITSTUDIO\\apps',
  'C:\\Users\\Owner\\Desktop\\HP関連本体datanextjs',
  'C:\\Users\\Owner\\Desktop\\カンパニーテスト',
  'C:\\Users\\Owner\\Downloads'
]

export interface DetectedCandidate {
  /** 実フォルダの絶対パス(正規化前・表示や起動に使う) */
  path: string
  /** フォルダ名 */
  dirName: string
  /** package.json の name(取得できた場合) */
  packageName: string | null
  /** Expo(React Native)プロジェクトか(dependencies に expo を含む) */
  isExpo: boolean
  /** slug の候補(台帳ハブ側で最終決定される。ここでは目安) */
  suggestedSlug: string
}

/** 走査の暴走を防ぐ上限(readDirectory 呼び出し回数)。 */
const MAX_DIRS_SCANNED = 2000

/**
 * パスを比較用に正規化する。Windows は大文字小文字を区別しないため小文字化し、
 * 区切りをスラッシュに統一、末尾スラッシュを除去する。
 * (台帳の paths.local はバックスラッシュ、readDirectory の返す path はスラッシュのため)
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function toSlug(source: string): string {
  return source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface PackageMeta {
  name: string | null
  isExpo: boolean
}

async function readPackageMeta(packageJsonPath: string): Promise<PackageMeta> {
  try {
    const result = await filesystemApi.readFile(packageJsonPath)
    if (!result.success) return { name: null, isExpo: false }
    const parsed = JSON.parse(result.data.content) as {
      name?: unknown
      dependencies?: Record<string, unknown>
      devDependencies?: Record<string, unknown>
    }
    const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null
    const isExpo = 'expo' in (parsed.dependencies ?? {}) || 'expo' in (parsed.devDependencies ?? {})
    return { name, isExpo }
  } catch {
    return { name: null, isExpo: false }
  }
}

/**
 * 指定フォルダ群を走査し、未登録のプロジェクト候補を返す。
 *
 * @param scanRoots 走査する起点フォルダの絶対パス群
 * @param registeredLocalPaths 台帳に登録済みの paths.local(apps.map(a => a.frontmatter.paths.local))
 * @param opts.maxDepth 各ルートから何階層下まで潜るか(既定2。例 Downloads/xxx/yyy のネストに対応)
 */
export async function detectUnregisteredApps(
  scanRoots: string[],
  registeredLocalPaths: string[],
  opts?: { maxDepth?: number }
): Promise<DetectedCandidate[]> {
  const maxDepth = opts?.maxDepth ?? 2
  const registered = new Set(registeredLocalPaths.map(normalizePath))
  const seen = new Set<string>()
  const candidates: DetectedCandidate[] = []
  let scannedCount = 0

  async function scanDir(dir: string, depth: number): Promise<void> {
    if (scannedCount >= MAX_DIRS_SCANNED) return
    scannedCount++
    const result = await filesystemApi.readDirectory(dir)
    if (!result.success) return
    const entries = result.data
    const packageEntry = entries.find((e) => e.type === 'file' && e.name === 'package.json')

    if (packageEntry) {
      // このフォルダ自体がプロジェクト。未登録なら候補にし、配下へは潜らない
      // (プロジェクト内の packages/* 等を二重に拾わないため)。
      const norm = normalizePath(dir)
      if (!registered.has(norm) && !seen.has(norm)) {
        seen.add(norm)
        const dirName =
          dir
            .replace(/[\\/]+$/, '')
            .split(/[\\/]/)
            .pop() ?? dir
        const meta = await readPackageMeta(packageEntry.path)
        candidates.push({
          path: dir,
          dirName,
          packageName: meta.name,
          isExpo: meta.isExpo,
          suggestedSlug: toSlug(meta.name ?? dirName)
        })
      }
      return
    }

    if (depth >= maxDepth) return
    for (const entry of entries) {
      if (entry.type === 'directory' && !entry.ignored) {
        await scanDir(entry.path, depth + 1)
      }
    }
  }

  for (const root of scanRoots) {
    await scanDir(root, 0)
  }

  candidates.sort((a, b) => a.dirName.localeCompare(b.dirName, 'ja'))
  return candidates
}
