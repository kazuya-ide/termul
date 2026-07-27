# LIT App Hub — Windows管理方針(Phase 0案)

作成日: 2026-07-27(2026-07-27 一体化方針への修正反映)
状態: 提案。実際の移動・変更は未実施。

---

## 1. 前提: 現状のTermulの実際の配置(実機確認済み)

| 種別 | パス | 備考 |
|---|---|---|
| インストール本体(exe) | `%LOCALAPPDATA%\Termul Manager\termul-manager.exe` | ユーザー単位インストール(NSIS `/S`で確認済み) |
| アプリ設定・データ | `%APPDATA%\com.termul-manager.app\termul-data.json` 他 | Tauri plugin-store、識別子は`com.termul-manager.app` |
| ログ | `%LOCALAPPDATA%\com.termul-manager.app\logs\termul.log` | 構造化ログ、起動ごとにセッションID付き |
| 組み込みブラウザのプロファイル | `%LOCALAPPDATA%\com.termul-manager.app\EBWebView\` | Edge WebView2の実データ |

## 2. LIT App Hubのアプリ本体・識別子(決定済み)

井手さんの「一体化したい」という意向を受け、**Tauriの識別子は変更せず`com.termul-manager.app`のまま**とする。つまりLIT App Hubは別アプリではなく、今井手さんが使っている日本語化フォークに機能を追加したものになる。インストール先も既存のまま(`%LOCALAPPDATA%\Termul Manager\termul-manager.exe`)で、新しいビルドをインストールすれば上書き更新される(先の日本語化作業と同じ手順)。

これにより「別々のアプリのデータが上書きし合うリスク」自体が発生しない(そもそも1つのアプリしか無いため)。Termul自体は現状スマートフォンでは動かないデスクトップ専用アプリであり、この決定はスマホ対応の可否に影響しない(スマホから一部情報を見たい、という要望が将来出た場合は、識別子とは別の話としてWeb版やAPI経由のアクセスを別途検討することになる)。

## 3. 推奨ディレクトリ構成

### アプリ本体
既存のまま。変更なし。
```
%LOCALAPPDATA%\Termul Manager\termul-manager.exe
```

### App Hub設定
```
%APPDATA%\com.termul-manager.app\
├─ termul-data.json      -- 既存Termul機能(Project/Terminal/Workspace等)の設定。変更なし
├─ app-hub-data.json      -- ManagedApp registry(新規、既存パターンに倣った命名)
├─ backup-metadata.json   -- 既存Migrationシステムをそのまま利用
├─ rollback-metadata.json
└─ backups\               -- ManagedApp registryの自動バックアップ(新規)
```
既存の`termul-data.json`と分離して`app-hub-data.json`を新設する理由: `ManagedApp`は`Project`と型もライフサイクルも異なる(データモデル文書参照)ため、既存ファイルに混ぜるとスキーマがふくれてマイグレーションが複雑になる。Tauri plugin-storeは複数ファイルを問題なく扱える。

### ログ・キャッシュ・実行中プロセス管理
```
%LOCALAPPDATA%\com.termul-manager.app\
├─ logs\                  -- 既存の termul.log 形式をそのまま利用(新規のログファイルは作らない)
├─ EBWebView\              -- 組み込みブラウザ(既存のまま)
├─ cache\                  -- アプリ検出結果の一時キャッシュ等(新規)
└─ processes\              -- 【追加提案、要検討】devサーバーの起動状態スナップショット。ただし「推奨アーキテクチャ」のとおりterminal_spawn経由で起動する場合、プロセス実体の管理は既存PtyManagerに委ねられるため、ここは「どのterminalIdがどのManagedAppのdevサーバーか」という薄い対応表だけで足りる可能性が高い
```

## 4. 開発プロジェクトの配置

**Phase 0〜MVPでは何も移動しない**。依頼書の指示どおり、現在のパスをそのまま`ManagedApp.projectPath`として登録するだけにする。

将来の標準ルート案(`C:\LIT-Workspace\01_COMPANY\...`)は`docs/LIT_APP_HUB_MIGRATION.md`にチェックリストとして用意した。強制はしない。

## 5. アプリ検出(スキャン)の実行範囲

依頼書どおり、初期状態でCドライブ全体はスキャンしない。井手さんが明示的に選んだフォルダ(Desktop、Documents、Downloads、OneDrive Desktop、指定フォルダ)のみを対象にする。検出は`fs`の再帰列挙+`package.json`等のマーカーファイル存在確認で行い、Rust側で新しいTauriコマンドを1つ追加する形を想定(`fs_scan_for_apps`のような名前、既存の`commands.rs`の構成パターンに倣う)。結果は必ず確認待ち一覧として表示し、自動登録はしない(依頼書10章のとおり)。

## 6. リポジトリ構成(2026-07-27 実施済み)

GitHub上に`https://github.com/kazuya-ide/termul`(本家`gnoviawan/termul`のフォーク)を作成し、ローカルの`termul-ja`リポジトリの`origin`をここに向け直した。本家は`upstream`という名前で参照できるようにしてある。

- `ja-localization`ブランチ: 日本語化のみを含む(2026-07-27にコミット済み、`kazuya-ide/termul`へpush済み)
- `feat/lit-app-hub`ブランチ: `ja-localization`から分岐。ここにApp Hub機能を実装していく(push済み、まだ中身は無し)

**追加提案**: `README.md`冒頭に「This is a fork of [termul](https://github.com/gnoviawan/termul) with Japanese localization and LIT App Hub extensions」のような一文を追加し、MITライセンス・アップストリーム追従のしやすさを保つことを推奨する。
