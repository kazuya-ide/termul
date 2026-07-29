# LIT App Hub — 実装計画(Phase 0)

作成日: 2026-07-27(2026-07-27 一体化方針への修正反映)
対象リポジトリ: `kazuya-ide/termul`(本家`gnoviawan/termul`のフォーク。日本語化フォーク`ja-localization`ブランチから`feat/lit-app-hub`を分岐)
状態: **Phase 2〜7 実装済み(2026-07-29時点)。** ホーム画面・アプリ詳細・起動(フォルダ/VS Code/Claude Code/devサーバー)・画面プレビュー(埋め込みブラウザ)・アプリ自動検出・台帳バックアップ/エクスポート・表示設定の永続化・UIの日本語化まで実装済み。残りは Phase 8(Expo拡張)のみ。

---

## 0. 方針変更のお知らせ(井手さんのフィードバック反映)

初版では「LIT App Hubは別アプリとして独立させる案(Tauri識別子を新規にする)」を推奨していたが、井手さんの「一体化したい」という意向を受け、**既に日本語化して日常利用しているTermul(`com.termul-manager.app`、このリポジトリ)にLIT App Hub機能をそのまま追加する**方針に変更した。別アプリを維持する複雑さ(2つのインストール、データの出所を気にする手間)が無くなるため、この方が井手さんの目的(アプリ管理をしたいだけ)に合っている。

また、初版で提案した「BOT・本番実行への確認ダイアログ必須化」「テスト実行と本番実行の厳格な分離」は、井手さんから明確に「不要、論点がずれている」との指摘を受けた。Claude(自分)が実装・管理するBOTを毎回審査する運用は望まれていない。**このため本ドキュメント以降、BOT関連の安全設計は「コード内部でシェル文字列結合を避ける」等の実装上の安全性に留め、確認ダイアログ・リスク表示のようなユーザー操作の手間は要件から外している。**(詳細は`LIT_APP_HUB_SECURITY.md`参照)

## 1. 要件の理解

「LIT App Hub」は、Termul(プロジェクト単位でターミナルを管理するTauriデスクトップアプリ)を土台に、Windows上に散在する20以上のWebアプリ・BOT・開発プロジェクトを1つのUIから

- 探す(カード型ホーム画面、検索、分類)
- 開発する(フォルダ/VS Code/ターミナル/Claude Code CLIを開く、devサーバー起動・停止)
- 確認する(Local/Staging/Productionをアプリ内ブラウザまたは外部ブラウザで、PC/タブレット/スマホサイズで確認)
- 関連資料に辿る(議事録・設計書・GitHub・各種SaaSダッシュボード)

を行えるようにする「母艦」として実装する依頼である。既存Termulの機能・ライセンス表記・アップデート取り込みやすさを壊さないことが必須条件。

Phase 0では**コード変更・パッケージ更新・既存ファイルの移動削除・アプリ/BOTの実行は一切行っていない**。以下はすべて調査結果と設計案であり、実装は次の承認を待つ。

---

## 2. Termul現行構造の調査結果(質問1〜18への回答)

Termulには`docs/`配下に公式の生成済みアーキテクチャ文書(`project-context.md`, `architecture.md`, `project-overview.md`, `source-tree-analysis.md`, `component-inventory.md`, `api-contracts.md`, `development-guide.md`, `deployment-guide.md`, `contribution-guide.md`)が既に存在する。今回の調査はこれらの精読と、実際のソースコード・実際にインストールして生成された永続化ファイルの直接確認を組み合わせて行った。

### 1. 現在のデフォルトブランチ
`origin/HEAD -> origin/dev`。つまり**`dev`がデフォルト(統合)ブランチ**。`main`は別に存在し、リリース済みの安定版の系列(`release/v0.3.x`, `release/v0.4.0`等のブランチ、`v0.4.8`等のタグ)。

### 2. 安定版と開発版の関係
`dev`にPRをマージして開発を進め(`CLAUDE.md`: 「code review action runs automatically on PRs targeting `dev`」)、リリース時にバージョンタグ(`v*`)をpushすると`.github/workflows/release.yml`が起動し、`package.json`・`src-tauri/Cargo.toml`・`src-tauri/tauri.conf.json`のバージョン整合を検証した上でWindows/Linux/macOS向けビルドと署名済み自動更新アーティファクト(`latest.json`, `.sig`)を生成・公開する。`main`はこのリリース系列を反映する側。

### 3. 現在のプロジェクト管理方法
`src/renderer/types/project.ts`の`Project`型(id/name/color/path/isActive/isArchived/gitBranch/lastOpened/defaultShell/envVars/worktrees/activeWorktreeId/isGitRepo/symlinkDirs)を、`project-store.ts`(Zustand)が保持。`ProjectSidebar.tsx`が一覧・切替・並び替え・アーカイブ・色変更・ワークツリー管理のUIを提供。**`ProjectGroup`型(id/name/projectIds[]/isCollapsed?/color?)も既に存在**し、サイドバーの「フォルダへ移動」機能で使われている(フラットな1階層のグルーピング)。

### 4. プロジェクト情報の保存場所と形式
Tauri `plugin-store`によるJSON。実機で確認した実際のパス:
```
%APPDATA%\com.termul-manager.app\termul-data.json   -- 本体データ(_version+dataのラップ形式)
%APPDATA%\com.termul-manager.app\backup-metadata.json
%APPDATA%\com.termul-manager.app\rollback-metadata.json
%APPDATA%\com.termul-manager.app\whats-new.json
```
論理キー例(開発ガイド記載): `projects`, `terminals/{projectId}`, `snapshots/{projectId}`, `window-state`, `settings/app`。実機の`termul-data.json`には`window-state`と`settings/app`が確認できた(プロジェクト未作成のため)。値は`{ "_version": 1, "data": {...} }`という**バージョン付きラップ形式**で保存されている。

### 5. ターミナルの起動方法
Rust側`terminal_spawn`コマンド(`src-tauri/src/commands.rs`)がPTY(`tauri-pty`/`portable-pty`、Windowsは ConPTY)を起動。フロントは`src/renderer/lib/terminal-spawn.ts`の`spawnTerminalInPane()`がPTY起動→`terminal-store`へのレコード追加→`workspace-store`へのタブ追加を一括で行う共通経路。

### 6. プロセス管理の実装状況
**重要な発見**: `TerminalSpawnOptions`(`src/shared/types/ipc.types.ts`)に`program?: string` / `args?: string[]` / `kind?: 'shell' | 'agent'`というフィールドが既にある(コード中のコメントは`ADR-004.2`を参照)。`program`を指定すると、ログインシェルを起動する代わりに**そのプログラムをargv経由で直接起動する**。コメントに明記: 「promptは常にargsの1要素であり、シェル展開されることは絶対にない。Rust側のspawn経路(POSIXはargv、Windowsは監査済みのコマンドライン引用処理)がこれを保証する」。この経路は`src/renderer/lib/agent-launch.ts`の`launchAgentInPane()`が、Claude Code/Cursor等のCLIエージェントをターミナルタブとして起動するために実際に使っている。**つまり「実行ファイル+引数+作業ディレクトリを分離し、シェル文字列結合を避ける」という今回の依頼の安全要件は、Termulに既に実装済みの経路がある。**PIDや終了コードは`terminal_get_exit_code`等のtracker経由で取得可能(`src-tauri/src/trackers/exit_code_tracker.rs`)。

### 7. ファイルエクスプローラーの実装状況
`src/renderer/components/file-explorer/FileExplorer.tsx`(ツリー・選択・インライン作成/リネーム・クリップボード操作)+`FileTreeNode.tsx`+`FileTreeContextMenu.tsx`(右クリックメニュー、新規ファイル/フォルダ/コピー/切り取り/貼り付け/複製/名前変更/削除/パスをコピー/ターミナルで開く/外部アプリで開く/ファイルマネージャーで表示)。「外部アプリで開く」「エクスプローラーで表示」は`src/renderer/lib/tauri-opener-api.ts`(`@tauri-apps/plugin-opener`の`openPath`/`openUrl`/`revealItemInDir`)経由。ファイル監視は`use-file-watcher.ts`。

### 8. 埋め込みブラウザの実装状況
Rust側`browser_tab_manager.rs`が子WebView(実機確認: `%LOCALAPPDATA%\com.termul-manager.app\EBWebView\`にEdge WebView2のプロファイルが実在)を作成・破棄・表示/非表示・ナビゲーション操作。`browser_tab_inject_annotation`等で`src-tauri/resources/annotation-overlay.js`を注入し、範囲選択・要素選択のアノテーション機能を実装(かなり作り込まれたサブシステム)。フロント側は`browser-session-store.ts`+`annotation-store.ts`+`BrowserPanel.tsx`/`BrowserControls.tsx`/`AnnotationPanel.tsx`+`browser-api.ts`。

### 9. ワークスペースレイアウトの保存方法
`workspace-store.ts`がペインツリー(分割・アクティブペイン・タブ)を管理。永続化はTauri store経由(デバウンス書き込み+クローズ時フラッシュ)。ウィンドウ位置・サイズ・最大化状態は`window-state`キーに保存(実機で確認済み。ちなみに今回のスクショ検証で「ウィンドウが173×55と極小だった」原因は、Windowsが最小化ウィンドウに使う座標`x:-32000, y:-32000`が保存されていたためと分かった=バグではない)。

### 10. Zustandストアの構造
確認できた主要ストア: `project-store` / `terminal-store` / `workspace-store` / `editor-store` / `browser-session-store` / `annotation-store` / `snapshot-store` / `app-settings-store` / `context-bar-settings-store` / `updater-store` / `theme-picker-store` / `keyboard-shortcuts-store`。いずれも「ストア+専用hook(例: `use-projects-persistence`, `use-terminal-restore`, `use-snapshots`)」の対で構成され、`getState()`直読み(非リアクティブ)とセレクタ経由の両方が使われている。

### 11. Tauri側のコマンド構造
`src-tauri/src/commands.rs`に集約。`IpcResult<T>`(`{success:true,data}` / `{success:false,error,code}`)で統一。系統は「terminal_*」「browser_tab_*」「data_migration_*」の3系統+`detect_shells`/`get_default_shell`/`get_home_directory`。

### 12. Windowsで外部アプリを起動する既存機能
- ファイル/URLを既定アプリ・ブラウザで開く、フォルダをエクスプローラーで表示: `tauri-opener-api.ts`(`openPath`/`openUrl`/`revealItemInDir`)。
- シェル検出: `shell-api.ts`(`detect_shells`、結果はフロントでキャッシュ)。
- 任意プログラムをargv安全に起動: 上記6.の`terminal_spawn`の`program`/`args`/`kind`経路(現状は`kind: 'agent'`用途のみで使われているが、型定義自体は汎用)。
- **VS Codeを開く専用の既存機能は見当たらなかった**(`code`コマンド起動の専用アダプタは未確認)。新規実装が必要。

### 13. 自動アップデートの実装状況
`@tauri-apps/plugin-updater` + `updater-store.ts` + `UpdateAvailableToast.tsx`/`UpdateReadyModal.tsx`/`WhatsNewModal.tsx`。`tauri.conf.json`にminisign公開鍵を埋め込み、更新元は`https://github.com/gnoviawan/termul/releases/latest/download/latest.json`固定。署名はGitHub Secrets(`TAURI_SIGNING_PRIVATE_KEY`等)でCIのみが持つ。**ローカルビルドでは署名できない**(実際に先のJapanese化ビルドで遭遇済み)。

### 14. 既存テストの内容
`*.test.ts`/`*.test.tsx`がソースと同じ場所に配置(Vitest + Testing Library + jsdom)。実測で158件のテストファイルを確認(先の日本語化作業時の副産物調査より)。Rust側は`cargo test`+`cargo clippy --all-targets -- -D warnings`。CI(`pr-validation.yml`)がlint/typecheck/test/cargo check/cargo test/cargo clippy/Tauriフロントエンドビルドを必須ゲートにしている。

### 15. 今回の実装で流用できる部分
「3.基本コンセプト」参照(次章で詳述)。要点だけ: Project/ProjectSidebar/WorkspaceLayout/PaneRenderer/Terminal(`terminal_spawn`のprogram/args経路)/BrowserPanel/FileExplorer/opener-api/updater/migrationシステム。

### 16. 今回追加が必要な部分
- App Hubホーム画面(カード一覧・検索・分類フィルタ)
- `ManagedApp`データモデルとストア・永続化(既存migrationシステムに相乗り)
- アプリ詳細画面(6タブ)
- Local/Staging/Production切り替え付きのプレビューUI(デバイスサイズ切り替え含む、BrowserPanelを内包する新しい上位コンポーネント)
- devサーバー起動・停止・ログ表示のUI(`terminal_spawn`のprogram/args経路を「devサーバー」用途にも拡張)
- VS Code起動アダプタ
- アプリ自動検出(フォルダスキャン)
- Windows運用機能(ショートカット、システムトレイ、単一起動 等、詳細は次章)

### 17. 破壊的変更になりそうな部分
現状の調査では、既存Termul機能(Project/Terminal/Browser/FileExplorer等)に手を入れずに追加できる設計が成立する(次章参照)。唯一注意が必要なのは`TerminalSpawnOptions.kind`の型を`'shell' | 'agent'`から`'shell' | 'agent' | 'devserver'`のように**拡張**する点(既存値を変更しないので後方互換だが、Rust側`kind`を分岐処理している箇所があれば両方updateが必要)。

### 18. ライセンス上残す必要がある表示・ファイル
`LICENSE`(MIT、Copyright (c) 2025 gnoviawan、Copyright (c) 2026 mannnrachman)をそのまま維持する。README/CONTRIBUTING.mdのクレジット表記も変更しない。フォークである旨・upstream URLの記載を保つことを推奨(追加提案として次章に記載)。

---

## 3. 推奨アーキテクチャ:「Termul標準モード」+「App Hubホーム」

### 結論
**ホーム画面にApp Hubを追加し、カードから「開発を開く」を押すと既存のTermulワークスペース(ProjectSidebar/WorkspaceLayout)へ遷移する方式**を推奨する。「App Hubモード」と「Termul標準モード」を完全に切り替える二重モード方式は採用しない。

理由:
- `ManagedApp`(カタログ全体を管理する概念)と`Project`(1つのフォルダを開いた作業単位)は**意味が違う**。`remote-web`/`service-link`/`collection`はフォルダを持たない場合があり、既存`Project`型に無理に統合すると`path?`等がさらに曖昧になる。別の型・別のストアとして持ち、`ManagedApp.projectPath`が既存Projectと一致する場合は**紐付け**る設計にする。
- 「開発を開く」を押した時の処理は: (a) `projectPath`に一致する既存`Project`があれば`setActiveProject`する、(b) 無ければ`createProject({name, path, ...})`して新規作成する、その後ワークスペース画面へ`navigate`する、の2択で済む。これは既存`project-store`のAPIをそのまま呼ぶだけで、ProjectSidebar/WorkspaceLayoutは1行も変更不要。
- 「画面を見る」はワークスペースに入らずに独立したプレビュー画面(新規)を開く。BrowserPanelのロジック(browser-session-store・browser-api・BrowserTabManager)を**呼び出す側**として新規のプレビューコンポーネントを作るが、Browser側の実装そのものは変更しない。

### モジュール構成案
```
src/renderer/
  pages/
    AppHubHome.tsx          [新規] カード一覧・検索・分類
    AppHubDetail.tsx        [新規] アプリ詳細(6タブ)
    AppHubPreview.tsx       [新規] Local/Staging/Production + デバイスサイズ切替
  stores/
    app-hub-store.ts        [新規] ManagedApp CRUD・検索インデックス
    app-hub-process-store.ts [新規] 起動中devサーバーの状態(terminalIdへの参照のみ持つ、実体はterminal-storeのまま)
  lib/
    app-hub-discovery.ts    [新規] フォルダスキャン→候補推定
    app-hub-launch.ts       [新規] "開発を開く"/"画面を見る"/devサーバー起動のオーケストレーション(既存 terminal-spawn.ts, project-store, tauri-opener-api を呼ぶだけ)
    vscode-api.ts           [新規] VS Code起動アダプタ(既存 shell-api.ts / tauri-opener-api.ts と同じ「adapterはlib/に置く」パターンを踏襲)
```

`project-context.md`の既存ルール(「`src/renderer/lib/`のアダプタ境界を飛ばして直接Tauri/pluginを呼ぶな」「Zustandの既存パターンを再利用せよ」「`@renderer/*`/`@shared/*`エイリアスを使え」)にすべて従う設計。

---

## 4. 実装フェーズ(依頼書 第18章を本リポジトリの実態に合わせて具体化)

| Phase | 内容 | 変更ファイル(新規/既存) |
|---|---|---|
| 0 | 調査・設計(本ドキュメント) | `docs/LIT_APP_HUB_*.md`(新規のみ) |
| 1 | Termul無改造で動作確認 | 変更なし。`bun install`/`bun run dev`/`test`/`typecheck`/`lint`/`build:tauri:win`を実行し基準を記録 |
| 2 | App Hubホーム画面(データ無しの空UI+モック) | `app-hub-store.ts`, `AppHubHome.tsx`, ルーティング追加 |
| 3 | 開発・フォルダ画面 | `app-hub-launch.ts`, `vscode-api.ts`, `AppHubDetail.tsx`の該当タブ |
| 4 | 画面確認(Local/Staging/Production) | `AppHubPreview.tsx`(BrowserPanelを内部で利用) |
| 5 | プロセス管理(devサーバー起動・停止・ログ) | `terminal_spawn`の`kind`拡張(Rust+shared types)、`app-hub-process-store.ts` |
| 6 | アプリ自動検出 | `app-hub-discovery.ts` |
| 7 | Windows運用機能(バックアップ・エクスポート・ショートカット等) | `app-hub-store.ts`の永続化を既存Migrationシステムに登録 |
| 8 | Expo拡張 | MVP後の別フェーズ |

各フェーズ終了時: `bun run test && bun run typecheck && bun run lint`、必要に応じて`cd src-tauri && cargo check --all-targets && cargo test && cargo clippy --all-targets -- -D warnings`、最終的に`bun run build:tauri:win`。

---

## 5. リスク

1. **devサーバーのkind拡張がRust側にも波及する**: `TerminalSpawnOptions.kind`をshared typesだけでなくRust側`commands.rs`のマッチ処理でも見ている場合、両方の変更が必要(Phase 5で要確認)。
2. **BrowserPanelの内部状態(browser-session-store)がプロジェクト単位を前提にしている可能性**: `ManagedApp`のプレビューは必ずしも`Project`に紐付かない(`remote-web`はProjectを持たない)ため、Browser側がprojectId必須の設計であれば、projectId無しでも動くよう小さな調整が要るかもしれない(Phase 4で実装しながら確認)。
3. **既存`ProjectGroup`との概念衝突**: サイドバーの「グループ」とApp Hubの「Company/Personal/SNS」分類は別物だが、ユーザーには似て見える。UI文言・ドキュメントで明確に区別する。
4. **自動更新への影響(方針決定済み)**: このリポジトリ(`feat/lit-app-hub`)はupstreamの署名鍵を持たないため、ビルドしたバイナリの自動更新チェックは機能しない(先のJP化フォークと同じ制約)。**個人利用ツールとして使う前提のため、自動更新は無効のままでよい**という方針で確定。更新が必要になったときは手元で再ビルドする運用とし、upstreamの署名鍵を引き継ぐ予定は無い。

---

## 6. 変更予定ファイル(初回MVP範囲、Phase 2〜3相当)

新規:
- `src/renderer/pages/AppHubHome.tsx`
- `src/renderer/pages/AppHubDetail.tsx`
- `src/renderer/stores/app-hub-store.ts`
- `src/renderer/lib/app-hub-launch.ts`
- `src/renderer/lib/vscode-api.ts`
- `src/shared/types/app-hub.types.ts`(`ManagedApp`等の型)
- `docs/LIT_APP_HUB_PLAN.md` / `WINDOWS_MANAGEMENT_PLAN.md` / `LIT_APP_HUB_DATA_MODEL.md` / `LIT_APP_HUB_SECURITY.md` / `LIT_APP_HUB_MIGRATION.md`(本Phase 0で作成済み)

既存に手を入れる可能性がある箇所(最小限):
- `src/shared/types/ipc.types.ts`(`TerminalSpawnOptions.kind`に値を追加。Phase 5)
- ルーティング設定ファイル(ホーム画面への入口追加。ファイル名は要確認、hash-router設定箇所)

---

## 7. 推定作業量

具体的な日数・時間はここでは記載しない(時間軸は井手さんが明示した場合のみ扱う方針のため)。規模の目安としては、Phase 2〜7それぞれが「新規ファイル数点+既存への小さな接続点1〜2箇所」程度で収まる設計にしており、Phase 4(プレビュー)とPhase 6(自動検出)が最もコード量が多くなる見込み。
