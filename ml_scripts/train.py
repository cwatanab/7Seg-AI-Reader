import os
from pathlib import Path
from ultralytics import YOLO
import ultralytics.data.dataset

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
    yaml_path = PROJECT_ROOT / "datasets" / "data.yaml"
    if not yaml_path.exists():
        yaml_path = PROJECT_ROOT / "datasets" / "LCD-1" / "data.yaml"
    if not yaml_path.exists():
        possible_paths = list(PROJECT_ROOT.glob("**/data.yaml"))
        if possible_paths:
            yaml_path = possible_paths[0]

    if not yaml_path.exists():
        print(f"エラー: 設定ファイル '{yaml_path}' が見つかりません。先に download_dataset.py を実行してください。")
        return

    print(f"使用する設定ファイル: {yaml_path}")

    last_pt = PROJECT_ROOT / "runs" / "detect" / "yolo26_lcd_mono_digits_only" / "weights" / "last.pt"
    if last_pt.exists():
        print(f"🔄 前回のチェックポイント ({last_pt}) から学習を再開 (resume) します...")
        model = YOLO(str(last_pt))
        results = model.train(
            resume=True,
            workers=0
        )
    else:
        if (models_dir / "7-segment-digits-yolo26s.pt").exists():
            model_path = str(models_dir / "7-segment-digits-yolo26s.pt")
        elif (models_dir / "yolo26s.pt").exists():
            model_path = str(models_dir / "yolo26s.pt")
        else:
            model_path = model_name

        print(f"YOLO26 モデル ({model_path}) をロード中...")
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
            name="yolo26_lcd_mono_digits_only",
            project=str(PROJECT_ROOT / "runs" / "detect")
        )
    
    print(f"\n学習完了！ 結果およびモデルは以下に保存されました:\n{results.save_dir}")

if __name__ == "__main__":
    train()
