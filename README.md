# Creative Canvas

ノードベースのクリエイティブ・キャンバス（画像/動画生成・編集をノードでつなぐデスクトップアプリ）。
**Claude Code から操作**できる MCP サーバを内蔵し、チャットで指示するだけでキャンバスを組み立て・生成できます。

- デスクトップアプリ（Electron）＋内蔵サーバ＋ React キャンバス UI
- `creative-canvas` MCP サーバ同梱（このフォルダを Claude Code で開くと自動登録）
- 生成データはすべて**各自の端末ローカル**に保存（リポジトリでは共有されません）

---

## 必要なもの

- **Node.js 18 以上**（推奨 LTS） … https://nodejs.org
- **git**
- **Claude Code**
- **KIE AI の API キー** … https://kie.ai （画像 `nano-banana-2` / 動画 `kling-3.0` を使用）
  - 無くても `MOCK_PROVIDER=1` でプレースホルダ生成のお試しは可能

対応 OS: **macOS / Windows**

---

## セットアップ（Claude Code が全部やります）

1. このリポジトリをクローンし、そのフォルダを **Claude Code で開く**
   ```bash
   git clone https://github.com/yzrkbys/creative-canvas.git
   cd creative-canvas
   ```
   ※ Private リポジトリです。事前にオーナーから GitHub アカウントを Collaborator 招待してもらってください（招待メールの承認が必要）。
2. Claude Code のチャットで次を実行
   ```
   /setup
   ```
   → 依存インストール（`npm install`）→ ビルド＆起動（`npm run app`）まで自動で進みます。

3. アプリが起動したら、メニュー **「Canvas → 設定（APIキー）を開く」** で `KIE_API_KEY` を貼り付けて保存 → アプリを再起動。

> 手動で進めたい場合:
> ```bash
> npm install
> npm run app
> ```

---

## 使い方

1. **Creative Canvas アプリを起動しておく**（内蔵サーバが `localhost:8787` で待ち受けます）。
2. このフォルダを開いた Claude Code のチャットで指示するだけ。例:
   - 「『夕焼けの富士山』の画像ノードを作って生成して」
   - 「この画像から5秒の動画を作って」
   MCP（`creative-canvas`）経由でノードの追加・接続・生成が行われ、キャンバスにリアルタイム反映されます。
   - プロジェクト一覧（トップ画面）も自動同期します。

---

## アップデート

Claude Code のチャットで:
```
/update
```
→ `git pull` → `npm install` → `npm run app`（再ビルド＆起動）を自動実行します。

作業データ・API キーは更新しても保持されます。

---

## データの保存場所（共有されません）

プロジェクト（グラフ）・生成画像/動画・API キーは、リポジトリではなく各自の端末に保存されます。

- macOS: `~/Library/Application Support/Creative Canvas/`
- Windows: `%APPDATA%\Creative Canvas\`

リポジトリには作業データ・`.env`（APIキー）は含まれません（`.gitignore` 済み）。

---

## 開発者向けメモ

- ブラウザ開発モード: `npm run dev`（server:8787 + web:5173）。`.env` は `.env.example` をコピーして作成。
- 型チェック: `npm run typecheck`
- 構成: `server/`（Express + WebSocket・内蔵API）/ `web/`（React + React Flow）/ `mcp/`（stdio MCP→HTTP）/ `desktop/`（Electron）
- 配布パッケージ（任意・署名が必要）: `npm run app:dist`（現状 macOS ターゲット。Windows インストーラを作る場合は `desktop/package.json` の `build` に win ターゲットを追加）
