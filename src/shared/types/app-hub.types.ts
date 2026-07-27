import { z } from 'zod'

/**
 * LIT App Hub のデータ型。アプリ台帳ハブ(C:\Users\Owner\Desktop\アプリ台帳ハブ)の
 * registry/apps/*.md(gray-matter frontmatter)と完全に同じスキーマを共有する。
 * Termul側で別の台帳は持たない — 台帳は1つだけ、というのが要件。
 *
 * スキーマの原本: アプリ台帳ハブ側の src/lib/registry/schema.ts
 */

export const RELATION_TYPES = [
  'forked_from',
  'sibling_fork',
  'depends_on',
  'calls_api_of',
  'successor_of',
  'other'
] as const

export const STATUS_VALUES = ['production', 'development', 'paused', 'archived', 'planned'] as const
export const SEVERITY_VALUES = ['low', 'medium', 'high'] as const
export const KIND_VALUES = ['app', 'website', 'tool'] as const
export const KIND_LABEL: Record<(typeof KIND_VALUES)[number], string> = {
  app: 'アプリ',
  website: 'HP',
  tool: 'ツール'
}
export const STATUS_LABEL: Record<(typeof STATUS_VALUES)[number], string> = {
  production: '稼働中',
  development: '開発中',
  paused: '停止中',
  archived: 'アーカイブ',
  planned: '計画中'
}

// 表示に使う項目(name/kind/status/tags/paths/urls/launch/safe_commands)だけ
// 厳密にチェックする。related_apps/important_files/presets/todos/cautions/
// changelogはTermul側の画面では読んでいないため、アプリ台帳ハブ側の過去データが
// 型どおりでなくても(文字列配列のままの古い記録等)読み込み自体は失敗させない。
const looseArray = z.array(z.unknown()).default([])

/** null/undefined/空文字を安全に空文字へそろえる(台帳側にnullが入っている記録があるため)。 */
const nullableString = () =>
  z
    .string()
    .nullish()
    .transform((v) => v ?? '')

export const safeCommandSchema = z.object({
  id: z.string(),
  label: z.string(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  cwd: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined)
})

const appUrlsSchema = z.object({
  production: z.string().nullable().optional().default(null),
  admin: z.string().nullable().optional().default(null),
  github: z.string().nullable().optional().default(null),
  vercel: z.string().nullable().optional().default(null),
  supabase_dashboard: z.string().nullable().optional().default(null)
})

const appPortsSchema = z.object({
  dev: z.number().nullable().optional().default(null),
  supabase_local: z.number().nullable().optional().default(null)
})

const appLaunchSchema = z.object({
  dev_command: nullableString(),
  install_command: nullableString()
})

const appPathsSchema = z.object({
  local: z.string()
})

export const appFrontmatterSchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: z.enum(KIND_VALUES).default('app'),
  brand_name: z.string().nullable().optional().default(null),
  status: z.enum(STATUS_VALUES).default('development'),
  company: z.string().optional().default(''),
  project_group: z.string().optional().default('その他'),
  category: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  created_at: z.string().nullable().optional().default(null),
  tech_stack: z.array(z.string()).default([]),
  paths: appPathsSchema,
  urls: appUrlsSchema.default({}),
  ports: appPortsSchema.default({}),
  launch: appLaunchSchema.default({}),
  related_apps: looseArray,
  related_notes: looseArray,
  important_files: looseArray,
  safe_commands: z.array(safeCommandSchema).default([]),
  presets: looseArray,
  todos: looseArray,
  cautions: looseArray,
  changelog: looseArray,
  updated_at: z.string().optional().default('')
})

export type AppFrontmatter = z.infer<typeof appFrontmatterSchema>
export type SafeCommand = z.infer<typeof safeCommandSchema>

export interface AppRecord {
  frontmatter: AppFrontmatter
  body: string
  /** 台帳ファイルの絶対パス(registry/apps/<slug>.md)。編集・再読込に使う。 */
  filePath: string
}
