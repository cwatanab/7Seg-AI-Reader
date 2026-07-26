# 7Seg AI Reader (YOLO26 & Web App)

7セグメント液晶ディスプレイ（LCD）の数字検出・識別を行う機械学習モデル（YOLO26）および Web アプリケーションのリポジトリです。

---

## 📁 ディレクトリ構成

プロジェクトは「**機械学習（Python / ML）**」、「**データセット（datasets）**」、「**モデル重み（models）**」、「**Webアプリケーション（React / Vite）**」に整理されています：

```
lcd/
├── datasets/                         # 📊 データセットフォルダ
│   └── LCD-1/                        # Roboflow データセット (4,241枚)
│
├── models/                           # 🤖 検出モデル (.pt, .onnx)
│   ├── 7-segment-digits-yolo26s.pt      # YOLO26 Small PyTorch 重み
│   ├── 7-segment-digits-yolo26s.onnx    # YOLO26 Small ONNX モデル
│   ├── 7-segment-digits-yolo26n.pt      # YOLO26 Nano PyTorch 重み
│   └── 7-segment-digits-yolo26n.onnx    # YOLO26 Nano ONNX モデル
│
├── ml_scripts/                       # 🐍 機械学習・評価・推論 Python スクリプト
│   ├── train.py                     # 高精度再学習スクリプト
│   ├── evaluate.py                  # モデル精度評価スクリプト (mAP, Precision, Recall)
│   ├── predict.py                   # 画像・動画に対する推論テスト
│   ├── realtime_webcam.py           # Webカメラリアルタイム検出 (OpenCV)
│   ├── export_onnx.py               # ONNX エクスポートスクリプト
│   ├── download_dataset.py          # Roboflow データセット取得
│   ├── convert_to_grayscale.py      # 画像モノクロ一括変換
│   └── check_dataset.py             # データセット仕様確認
│
├── runs/                             # 📈 学習・評価の出力結果 (detect / val / predict)
│
├── src/                              # 🌐 Webアプリケーション ソースコード (React)
├── public/                           # Webアプリ用静的アセット
├── index.html                        # Webアプリ エントリーポイント
├── package.json                      # Webアプリ 依存関係 (bun / npm)
├── pyproject.toml                    # Python 依存関係 (uv / pip)
├── 7-segment-digits-yolo26s.md          # モデル仕様・評価ドキュメント
└── README.md                         # 本ドキュメント
```

---

## 🚀 使い方

### 1. 機械学習・推論スクリプト (Python)

仮想環境の Python (`.\.venv\Scripts\python.exe`) を使用して実行します：

* **モデル精度評価 (mAP, Precision, Recall)**:
  ```powershell
  .\.venv\Scripts\python.exe ml_scripts/evaluate.py
  ```
* **Webカメラ リアルタイムテスト**:
  ```powershell
  .\.venv\Scripts\python.exe ml_scripts/realtime_webcam.py
  ```
* **推論実行**:
  ```powershell
  .\.venv\Scripts\python.exe ml_scripts/predict.py <画像パス>
  ```
* **再学習**:
  ```powershell
  .\.venv\Scripts\python.exe ml_scripts/train.py
  ```
* **ONNX 変換**:
  ```powershell
  .\.venv\Scripts\python.exe ml_scripts/export_onnx.py
  ```

---

### 2. Web アプリケーション (React / Vite)

```powershell
bun install
bun run dev
```
*ブラウザで起動し、ONNX Runtime Web によるローカル推論を行えます。*
