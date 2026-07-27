import os
import sys
import shutil
from pathlib import Path

# .venv の site-packages を優先追加
_venv_site = Path(__file__).resolve().parent / ".venv" / "Lib" / "site-packages"
if _venv_site.exists() and str(_venv_site) not in sys.path:
    sys.path.insert(0, str(_venv_site))

from ultralytics import YOLO
import ultralytics.data.dataset

# Windows 環境におけるマルチスレッド/マルチプロセスの権限・デッドロックエラー回避用パッチ
class SerialPool:
    def __init__(self, *args, **kwargs):
        pass
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass
    def imap(self, func, iterable, *args, **kwargs):
        for item in iterable:
            yield func(item)
    def map(self, func, iterable, *args, **kwargs):
        return [func(item) for item in iterable]

ultralytics.data.dataset.ThreadPool = SerialPool

PROJECT_ROOT = Path(__file__).resolve().parent.parent

def train():
    candidates = [
        PROJECT_ROOT / "datasets" / "data.yaml",
        Path(__file__).resolve().parent.parent / "datasets" / "data.yaml",
        Path("D:/Develop/7Seg-AI-Reader/datasets/data.yaml"),
        Path("../datasets/data.yaml").resolve(),
    ]
    
    yaml_path = None
    for cand in candidates:
        if os.path.exists(str(cand)) or cand.exists():
            yaml_path = cand
            break

    if not yaml_path:
        print(f"エラー: データセット設定ファイル 'data.yaml' がどの検索パスにも見つかりません。 (探索対象: {[str(c) for c in candidates]})")
        return

    # data.yaml の path: 行を現在の実際のパスへ自動補正
    try:
        yaml_content = yaml_path.read_text(encoding='utf-8')
        lines = yaml_content.splitlines()
        dataset_dir_str = (PROJECT_ROOT / "datasets").resolve().as_posix()
        updated_lines = []
        for line in lines:
            if line.startswith("path:"):
                updated_lines.append(f"path: {dataset_dir_str}")
            else:
                updated_lines.append(line)
        yaml_path.write_text("\n".join(updated_lines) + "\n", encoding='utf-8')
    except Exception as e:
        print(f"data.yaml の自動パス補正スキップ: {e}")

    print(f"🎯 学習用データセット設定ファイル: {yaml_path}")

    models_dir = PROJECT_ROOT / "models"
    models_dir.mkdir(exist_ok=True)
    default_model_name = "yolo26n.pt"

    detect_dir = PROJECT_ROOT / "runs" / "detect"
    last_pts = list(detect_dir.glob("**/weights/last.pt")) if detect_dir.exists() else []
    
    if last_pts:
        last_pt = max(last_pts, key=lambda p: p.stat().st_mtime)
        print(f"🔄 前回のチェックポイント ({last_pt}) から重みを引き継いで学習を継続します...")
        model_path = str(last_pt)
    else:
        if (models_dir / "yolo26n.pt").exists():
            model_path = str(models_dir / "yolo26n.pt")
        else:
            model_path = "yolo26n.pt"
        print(f"YOLO26 Nano ベースモデル ({model_path}) をロード中...")

    model = YOLO(model_path)

    print("高精度設定（150 エポック / バッチ32 / モノクロ最適化 / 数字・記号のみ）で学習を開始します...")
    results = model.train(
        data=str(yaml_path),
        epochs=150,           # エポック数
        patience=25,          # Early Stopping
        imgsz=640,            # 解像度
        batch=32,             # バッチサイズ
        classes=list(range(13)), # 0~12 ( - , . , 0~9 , dot ) のみ学習し、13 ('h'), 14 ('kW'), 15 ('null') を除外
        hsv_h=0.0,            # 色相オフ (モノクロ最適化)
        hsv_s=0.0,            # 彩度オフ (モノクロ最適化)
        hsv_v=0.4,            # 輝度・明度変動
        degrees=10.0,         # ランダム回転
        perspective=0.0005,   # パース変化
        mosaic=1.0,           # モザイク合成
        mixup=0.1,            # Mixup合成
        workers=0,            # Windowsマルチプロセス環境のアクセス拒否エラー回避
        name="yolo26n_lcd_mono_digits_only",
        project=str(PROJECT_ROOT / "runs" / "detect")
    )

    print(f"\n学習完了！ 結果およびモデルは以下に保存されました:\n{results.save_dir}")

    # 最良モデル (best.pt) を models/ ディレクトリにコピー保存
    best_pt = Path(results.save_dir) / "weights" / "best.pt"
    if best_pt.exists():
        target_pt = models_dir / "7-segment-digits-yolo26n.pt"
        shutil.copy(best_pt, target_pt)
        print(f"最良モデル重みを保存しました: {target_pt}")

if __name__ == "__main__":
    train()
