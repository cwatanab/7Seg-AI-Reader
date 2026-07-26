# AGENTS.md

AI エージェントおよび自動開発ツール向けの作業ガイド・ナレッジベースです。

## プロジェクト構成・ツールチェーン

- **ランタイム / パッケージマネージャー**: `bun` (`mise` 管理)
- **環境設定ファイル**: [mise.toml](file:///C:/Users/cwatanab/Desktop/lcd/mise.toml)
  - `bun = "latest"`
  - `python = "latest"`
  - `uv = "latest"`
- **フロントエンドスタック**: React 19 + TypeScript + Vite 6
- **推論エンジン**: ONNX Runtime Web (`onnxruntime-web`)

## 開発・デバッグ時の注意点 (Windows / Sandbox / Vite)

### 1. `mise` および `bun` のパス解決
- `mise` 経由のツールは `~/.local/state/mise` または `AppData/Local/mise/installs/bun/<version>/bin/bun.exe` にインストールされる。
- Windows の PowerShell 環境で PATH が未反映の場合や権限エラー（Access is denied）が発生する場合は、直打ちパス指定や `BypassSandbox: true` で実行する必要がある。

### 2. Vite + esbuild の親ディレクトリ探索による権限エラー
- **現現象**: Windows 環境において `vite.config.ts` や `vite.config.mjs` を配置すると、`esbuild` のバンドル処理が `C:\Users` 等のルート方向に遡って探索を行い `Cannot read directory "../..": Access is denied` で終了する。
- **回避策**:
  - `vite.config.ts` を削除/離脱させ、設定ファイルなしで `vite --host` を実行すると esbuild のトランスパイルステップが回避され正常に起動する。
  - プラグインや設定が必要な場合は、インライン引数や専用のカスタムローダーを検討する。

### 3. ONNX Runtime Web (`onnxruntime-web`) のヘッダー設定
- WebAssembly / SharedArrayBuffer を利用したマルチスレッド推論を行う場合、以下の Cross-Origin ヘッダーが必要になる：
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: credentialless`
- 設定ファイルを有効化して上記ヘッダーを設定する場合は、esbuild の親ディレクトリ探索問題に注意すること。

## 定常運用コマンド

```bash
# 依存関係インストール
bun install

# 開発サーバー起動
bun run dev
```
