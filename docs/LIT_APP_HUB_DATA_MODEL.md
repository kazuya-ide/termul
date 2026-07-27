# LIT App Hub — データモデル案(Phase 0)

作成日: 2026-07-27

---

## 1. 既存`Project`型との関係

実装調査の結果、`src/renderer/types/project.ts`の`Project`型は「1つのフォルダを開いた作業単位」を表す軽量な型で、`ManagedApp`(アプリのカタログ全体を表す型)とは責務が異なる。

| | `Project`(既存) | `ManagedApp`(新規) |
|---|---|---|
| 必須か | フォルダを開いて初めて作られる | フォルダが無い(`remote-web`等)アプリも登録できる必要がある |
| 主な用途 | ターミナル・ワークツリー・envの作業単位 | 検索・分類・起動導線・関連資料のカタログ |
| 保存場所 | `termul-data.json`の`projects`キー | 新設`app-hub-data.json`(理由は`WINDOWS_MANAGEMENT_PLAN.md`参照) |

**結論: `ManagedApp`は`Project`を置き換えず、`projectPath`で緩やかに紐付ける新規の型にする。** `ManagedApp.type`が`local-web`/`python-app`/`node-cli`等でローカルフォルダを持つ場合のみ、「開発を開く」操作時にfind-or-createで対応する`Project`を用意する。

## 2. `ManagedApp`型(依頼書の案をベースに、既存パターンへ合わせて微調整)

依頼書のTypeScript案は`src/renderer/types/project.ts`の命名規約(camelCase、`?`によるoptional、JSDocコメント最小限)と概ね一致しており、そのまま採用可能。以下の点のみ既存コードとの整合のため調整を提案する。

- `AppLaunchCommand`の`mode`は依頼書のまま(`development | preview | production | utility`)。ただし実際の起動は「6. プロセス管理との接続」のとおり既存`terminal_spawn`の`program`/`args`/`cwd`にそのままマッピングできるよう、`executable`ではなく`program`という既存の命名に合わせることを提案する(下記の型定義に反映済み)。
- `riskLevel`/`requiresConfirmation`は型としては残すが、**デフォルトで確認ダイアログを強制する動作にはしない**(井手さんのフィードバックにより方針変更。詳細は`LIT_APP_HUB_SECURITY.md`参照)。井手さんが個別のコマンドについて「これは毎回確認してほしい」と設定したい場合に使える任意フィールドとして持たせるに留める。二重起動防止(同じコマンドを多重実行させない)は事故防止として引き続き実装する。

```typescript
// src/shared/types/app-hub.types.ts (新規)

export type AppCategory =
  | 'company'
  | 'personal'
  | 'sns'
  | 'automation'
  | 'mobile'
  | 'other'

export type AppType =
  | 'remote-web'
  | 'local-web'
  | 'python-app'
  | 'python-bot'
  | 'node-cli'
  | 'expo'
  | 'desktop'
  | 'service-link'
  | 'collection'

export type AppStatus = 'active' | 'development' | 'review' | 'paused' | 'archived' | 'unknown'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface AppLaunchCommand {
  id: string
  name: string
  /** PATH解決可能な実行ファイル名、または絶対パス。terminal_spawnのprogramにそのまま渡す。 */
  program: string
  /** argvの各要素。シェル展開されない(ADR-004.2と同じ安全性)。 */
  args: string[]
  workingDirectory?: string
  environmentFilePath?: string
  mode: 'development' | 'preview' | 'production' | 'utility'
  requiresConfirmation: boolean
  riskLevel: RiskLevel
}

export interface AppUrl {
  id: string
  name: string
  type: 'local' | 'staging' | 'production' | 'documentation' | 'repository' | 'service' | 'store'
  url: string
  port?: number
  openMode: 'embedded' | 'external' | 'both'
}

export interface AppResource {
  id: string
  name: string
  type: 'file' | 'folder' | 'url' | 'database' | 'log' | 'document' | 'data'
  pathOrUrl: string
  description?: string
}

export interface ManagedApp {
  schemaVersion: number
  id: string
  name: string
  description?: string

  category: AppCategory
  type: AppType
  status: AppStatus
  riskLevel: RiskLevel

  parentCollectionId?: string
  relatedAppIds: string[]

  /** 既存Project.pathと一致する場合、"開発を開く"がこのProjectをfind-or-createする */
  projectPath?: string
  workspacePath?: string
  repositoryUrl?: string
  iconPath?: string

  runtime?: {
    type?: 'node' | 'python' | 'bun' | 'rust' | 'expo' | 'other'
    version?: string
    packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'uv'
    virtualEnvironmentPath?: string
  }

  launchCommands: AppLaunchCommand[]
  urls: AppUrl[]
  resources: AppResource[]

  tags: string[]
  notes?: string

  favorite: boolean
  createdAt: string
  updatedAt: string
  lastOpenedAt?: string
  lastStartedAt?: string
  lastHealthCheckAt?: string
}

export interface ManagedAppCollection {
  id: string
  name: string
  category: AppCategory
  childAppIds: string[]
  color?: string
}
```

`collection`型(Company等)は`ManagedApp`自身の`type: 'collection'`としても表現できるが、依頼書2章の「Companyは複数アプリをまとめるグループとしても扱う」を素直に満たすため、上記のとおり別途軽量な`ManagedAppCollection`も用意し、`ManagedApp.parentCollectionId`で参照する二段構えを提案する(既存の`ProjectGroup`がフラット1階層なのに対し、Company配下にさらにサブグループを置きたくなった場合の拡張余地を残すため)。**これは依頼書に無い追加提案であり、必須ではない**。単純に`collection`型の`ManagedApp`をそのまま親として使う設計でも成立する。

## 3. 保存方式: 案A(JSON/Tauri Store)を推奨

依頼書の比較軸に沿って判断すると、20〜100件規模のMVPでは**案A(JSON)を推奨**する。理由:

1. Termulの`data_migration_*`コマンド群(`src-tauri/src/migrations.rs`)が**既にバージョン管理・履歴・ロールバックの仕組みを持っている**。新しい永続化ドメイン(`app-hub-data.json`)を追加する形なら、この既存インフラにそのまま乗れる。SQLiteを導入すると、この既存Migrationシステムとは別にSQLite用のマイグレーション機構を新設する必要があり、二重管理になる。
2. 起動履歴・ログ履歴を大量に貯めて横断検索したくなった場合はSQLiteが有利だが、依頼書の完了条件(20件以上を検索できる)の規模ではJSONの線形検索で十分。
3. 将来アプリ数が増えて実際にSQLiteが要るとなった時も、`ManagedApp`が独立した型・独立したファイルになっていれば、そこだけ移行すればよい(Project等既存データに影響しない)。

## 4. 必須実装事項(依頼書8章より)

- `schemaVersion`: 型に含める(上記のとおり)。
- **データマイグレーション**: 新規に作らず、既存`MigrationManager`(`src-tauri/src/migrations.rs`)へ`app-hub-data.json`用のマイグレーションを登録する形にする。
- **自動バックアップ**: 既存の`backup-metadata.json`の仕組みを`app-hub-data.json`にも適用する(既存パターンの再利用)。
- **インポート/エクスポート**: `ManagedApp[]`をJSON配列として書き出す/読み込む単純な機能。読み込み時はZodスキーマ(既存プロジェクトが`react-hook-form`+`zod`を使っているのでこれに合わせる)でバリデーションする。
- **壊れた設定の復旧**: 既存Migrationシステムの`rollback`機能を利用。
- **重複ID検出**: インポート時・登録時に`id`重複、および`projectPath`重複(同じフォルダを2つのManagedAppが指す状態)を検出して警告する。
- **パス不存在の警告**: `ManagedApp`一覧表示時に`projectPath`/`workspacePath`の存在確認を行い(重い処理になるため画面表示のたびではなく、明示的な「再確認」操作またはアプリ起動時1回)、存在しない場合はカードに警告バッジを出す(依頼書5.1の「警告の有無」表示に対応)。

## 5. 検出結果(自動検出)の型

依頼書10章の検出候補は、確定前の一時データなので永続化対象の`ManagedApp`とは別の型にする。

```typescript
export interface DetectedAppCandidate {
  suggestedName: string
  suggestedType: AppType
  suggestedLaunchCommand?: Pick<AppLaunchCommand, 'program' | 'args' | 'workingDirectory'>
  suggestedUrl?: string
  suggestedPort?: number
  techStack: string[]
  gitRemoteUrl?: string
  confidence: 'high' | 'medium' | 'low'
  unknowns: string[]
  detectedAtPath: string
}
```

## 6. プロセス管理との接続(6章参照)

`AppLaunchCommand`の`mode: 'development'`を実行する際は、`app-hub-launch.ts`が以下のように既存APIへブリッジする(新しいRustコマンドは不要、`kind`の値追加のみ):

```
AppLaunchCommand { program, args, workingDirectory, riskLevel }
        ↓
terminalApi.spawn({ program, args, cwd: workingDirectory, kind: 'devserver' })
        ↓ (既存 terminal_spawn がPTYで起動、pid/stdout/stderrは既存トラッカーが提供)
terminalStore.addTerminal(...) → workspaceStore.addTabToPane(...)
        ↓
app-hub-process-store が { managedAppId, terminalId } の対応だけを保持
```
