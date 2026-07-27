# 7Seg AI Reader (YOLO26 & Web App)

7セグメント液晶ディスプレイ（LCD）の数字・記号検出および高速リアルタイム認識を行う Web アプリケーションおよび機械学習モデル（YOLO26）のリポジトリです。

---

## ⚡ 主な特徴

- **軽量 FP16 ONNX モデル (4.75 MB)**: 高精度な YOLO26 検出モデルを 16bit 浮動小数点 (FP16) に最適化し、ブラウザの高速ダウンロードと省メモリ動作を実現。
- **12クラス高精度対応**: `['-', '.', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']` の 12 種類を正確に認識。
- **マルチプロバイダーアクセラレーション**: WebGPU ➔ WebGL ➔ WASM (CPU SIMD) の自動フォールバックと安定なバッファパース設計。
- **省電力自動スリープ機能**: 30秒間未検出時、またはタブのバックグラウンド移動時にカメラトラックを自動解放し、省電力スリープモードへ移行。
- **直感的な Apple 風 2行統合ステータスバー**: アプリタイトル・FPS・推論時間・使用プロバイダーをコンパクトなカプセルバー内に一括表示。
- **OS標準フォント採用**: 外部ネットワーク依存を排除し、システム標準フォントによる最高レベルのレスポンス性能を確保。

---

## 📁 ディレクトリ構成

```text
7Seg-AI-Reader/
├── public/                           # 🌐 Webアプリ用静的アセット & ONNXモデル
│   ├── 7-segment-digits-yolo26n-fp16.onnx # FP16 ONNX モデル (4.75 MB)
│   ├── 7-segment-digits-yolo26n.onnx      # FP32 ONNX モデル (9.36 MB)
│   ├── _headers                        # Cloudflare Pages / Netlify 用 COOP/COEP 設定
│   ├── favicon.ico
│   └── manifest.json
│
├── src/                              # 💻 Webアプリケーション (React + TypeScript)
│   ├── components/
│   │   ├── LcdReader.tsx             # メイン認識オーケストレーション画面
│   │   ├── HeaderBar.tsx             # 2行統合ステータスヘッダーバー
│   │   ├── SettingsPanel.tsx         # 検出確信度・モノクロフィルター設定
│   │   ├── SleepOverlay.tsx          # スリープ状態オーバーレイ UI
│   │   └── DetectionPopup.tsx        # 1秒固定判定・4秒自動クローズ読み取りカード
│   │
│   └── utils/
│       ├── yoloInference.ts          # ONNX Runtime Web 推論エンジン・後処理ロジック
│       └── canvasUtils.ts            # バウンディングボックス Canvas 描画ユーティリティ
│
├── ml_scripts/                       # 🐍 Python 機械学習・モデル変換スクリプト
│   ├── train.py                      # YOLO26 再学習スクリプト
│   ├── evaluate.py                   # モデル精度評価スクリプト (mAP / Precision / Recall)
│   ├── predict.py                    # 画像・動画テスト推論スクリプト
│   ├── export_onnx.py                # ONNX 形式エクスポート (opset 17 指定)
│   └── convert_fp16.py               # ONNX ➔ FP16 (Half Precision) 変換スクリプト
│
├── datasets/                         # 📊 学習用データセット
├── index.html                        # Webアプリ エントリーポイント
├── package.json                      # Web依存関係 (bun / Vite)
└── README.md                         # 本ドキュメント
```

---

## 🚀 開発・起動手順

### 1. Web アプリケーションの起動 (React / Vite)

```bash
# 依存関係のインストール
bun install

# 開発サーバーの起動 (HTTPS 3000ポート)
bun run dev
```

ブラウザで `https://localhost:3000/` にアクセスしてカメラ権限を許可することで、ONNX Runtime Web による即時リアルタイム推論を実行できます。

---

### 2. 機械学習スクリプト (Python)

`uv` または仮想環境 Python (`ml_scripts/.venv`) を使用して実行します：

* **ONNX モデルへのエクスポート (opset 17)**:
  ```bash
  uv run python ml_scripts/export_onnx.py
  ```

* **FP16 量子化モデルへの変換**:
  ```bash
  uv run python ml_scripts/convert_fp16.py
  ```

* **モデル精度の評価 (mAP, Precision, Recall)**:
  ```bash
  uv run python ml_scripts/evaluate.py
  ```

---

## 🛠️ 技術スタック

* **フロントエンド**: React 18, TypeScript, Vite
* **推論エンジン**: ONNX Runtime Web (`onnxruntime-web`)
* **バックエンドプロバイダー**: WebGPU / WebGL / WebAssembly (WASM SIMD)
* **ML フレームワーク**: PyTorch, Ultralytics YOLO26
