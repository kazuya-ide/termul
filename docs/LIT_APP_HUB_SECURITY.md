# LIT App Hub — セキュリティ設計(Phase 0)

作成日: 2026-07-27(2026-07-27 井手さんのフィードバックにより7章を修正)

**方針**: 井手さんから「BOTは自分(Claude)が作っているので検査しなくていい。手間もかかるし、アプリ管理をしたいだけなのに論点がずれている」との指摘を受けた。そのため、この文書での「安全設計」は**コード内部の実装レベルの安全性**(シェル文字列結合を避ける、任意パスの実行ファイルを無警告で追加させない等)に絞り、**実行のたびに確認ダイアログを出す・リスクバッジを表示する・テスト実行と本番実行を強制的に分離する、といったユーザー操作の手間になる仕組みは入れない**。

---

## 1. プロセス起動の安全性(依頼書14章)

**既存Termulに、依頼書が求める安全設計(実行ファイルと引数を分離し、シェル文字列結合を避ける)がそのまま使える経路が既にある。**

`src/shared/types/ipc.types.ts`の`TerminalSpawnOptions`は`program?: string` / `args?: string[]`を持ち、コード内コメント(ADR-004.2参照)に「promptは常にargsの1要素であり、シェル展開されることは絶対にない」「Rust側のspawn経路(POSIXはargv、Windowsは監査済みのコマンドライン引用処理)がこれを保証する」と明記されている。これは`src/renderer/lib/agent-launch.ts`がClaude Code等のCLIエージェントを安全に起動するために実際に使っている経路であり、LIT App Hubのdevサーバー起動・VS Code起動もこれをそのまま再利用する。**新しい「文字列を組み立てて実行する」コードを書く必要はなく、書いてはならない。**

依頼書の「悪い例(`"cd " + path + " && npm run dev"`)」に相当するコードは、調査した範囲のTermul本体には見当たらなかった。LIT App Hub側でも同様のパターンは避ける。

## 2. 実行ファイルの許可リスト(追加提案)

依頼書が挙げる初期許可候補(`npm`, `npx`, `bun`, `pnpm`, `yarn`, `python`, `.venv\Scripts\python.exe`, `cargo`, `code`, `explorer.exe`, `wt.exe`, ブラウザ)は妥当。実装は`AppLaunchCommand.program`を保存・実行する前に、Rust側で以下を検証するコマンド(新規、`commands.rs`に追加)を挟むことを提案する。

- `program`がPATH解決可能な名前(許可リストに前方一致またはbasename一致)か、プロジェクト内の`.venv\Scripts\python.exe`のような既知の相対パターンか。
- それ以外(任意の絶対パス等)を登録しようとした場合は、登録時に一度だけ「これは許可リスト外の実行ファイルです」という表示を出す(実行のたびの確認ではなく、登録という一度きりの操作に対する軽い注意喚起に留める)。

これは`terminal_spawn`自体の変更ではなく、`ManagedApp`の`launchCommands`を保存する時点でのバリデーションとして実装する(呼び出し側の責務に閉じるため、既存Terminalサブシステムへの影響がない)。

## 3. `.env`・機密情報の扱い

`architecture.md`に明記されている既知の制約: 「env var persistence includes a documented future security hardening gap for secrets」「Project env vars are persisted in local store data, but secret-marked values are redacted before persistence and must be re-entered after app restart until secure OS storage is added」。

つまり**既存Termul自体が、機密情報の永続化についてまだ発展途上であることを自認している**。LIT App Hubはこの制約をそのまま引き継ぐ前提で設計し、悪化させない。

- `ManagedApp.launchCommands[].environmentFilePath`は**ファイルパスのみ**を保存し、`.env`の中身はUIに表示しない・ストアにも読み込まない(依頼書14章の要件どおり)。
- `AppResource`に`.env`ファイルへの参照を登録することは許可するが、`type: 'file'`として「開く」導線(既定エディタで開く)のみ提供し、内容をLIT App Hub自身がパースして画面表示することはしない。

## 4. ログの機密情報マスク

既存の`termul.log`は構造化ログ(`[date][time][module][LEVEL] message`)。devサーバーの標準出力・標準エラーは既存Terminalの transcript/scrollback の仕組みでそのまま保持される想定だが、APIキーやトークンが出力に混ざる可能性はTermul側も対策していないため、LIT App Hub固有の追加対策は行わない(依頼書は「ログの機密情報をマスクする」を要求しているが、これは汎用的な出力マスキングであり、Phase 0の調査範囲では既存Terminal側に該当機構は見当たらなかった。**必須要件との差分として明記し、実装フェーズで別途検討する**)。

## 5. パストラバーサル・URL検証

- ファイル操作(削除・リネーム等)は既存`FileExplorer`/`tauri-opener-api`の経路をそのまま使う限り、Termul本体が持つ検証をそのまま享受できる。LIT App Hub独自でファイルシステム操作を新設する場合(自動検出のスキャン等)は、必ずユーザーが指定したルート配下に限定し、シンボリックリンクによる脱出を考慮する。
- 外部URLを開く前の形式検証: `AppUrl.url`の保存時に`new URL(url)`でパースできることを確認し、`http:`/`https:`以外のスキーム(`file:`, `javascript:`等)を拒否する。

## 6. App Hub外で起動したプロセスへの不干渉

依頼書12章「ポート番号だけを基準に、他のプロセスを勝手に終了しないでください」に対応: devサーバーは必ず`terminal_spawn`経由(=Termul自身のPtyManagerがpidを把握している)で起動したものだけを`app-hub-process-store`が追跡し、停止操作は`terminal_kill`にその`terminalId`を渡すだけにする。ポート番号からOS全体のプロセスを検索して`taskkill`するような実装は行わない。

ポート競合検出は「起動しようとしたが失敗し、該当ポートが既に使用中」というdevサーバー自身のエラー出力を検知する形にとどめ、能動的に他プロセスを調べる機能は持たせない(依頼書の趣旨に合致)。

## 7. BOT・自動化コマンドの扱い(2026-07-27 修正)

井手さんのフィードバックにより、確認ダイアログの強制・テスト/本番の強制分離は行わない。実装するのは以下のみ:

- **二重起動防止のみ実装する**: `app-hub-process-store`が同一`ManagedApp.id`+同一`AppLaunchCommand.id`の組で既に実行中の`terminalId`を持っていれば、同じコマンドの多重起動をUI側でブロックする(誤操作で同じBOTが2つ同時に走ってデータが二重処理される、といった事故を防ぐための最低限の仕組み)。
- **実行コマンドの内容は常にログ・画面に表示する**: 何が起動したか井手さん自身が後から確認できるようにする(これは「確認を求める」のではなく「記録として残す」ためのもの)。
- 「CAPTCHAの回避、サイトの制限回避、ブロック回避を行う機能は追加しない」という制約自体は継続する(これは安全審査ではなく、単純に実装しない機能の宣言)。

## 8. 追加提案

- `ManagedApp`のインポート機能(4章のインポート/エクスポート)は、外部由来のJSONを読み込む唯一の入口になる。Zodスキーマでの基本的なバリデーション(型・必須項目)は行うが、許可リスト外の実行ファイルを無効化する等の追加ゲートは設けない(7章の方針と一貫させる)。
