import sys
import os
from pathlib import Path
from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parent.parent

def predict(source_path=None, weights_path=None, use_tta=True):
    models_dir = PROJECT_ROOT / "models"
    
    if not weights_path:
        possible_weights = list(models_dir.glob("7-segment-digits-yolo26n.pt")) + list(models_dir.glob("*.pt")) + list(PROJECT_ROOT.rglob("*.pt"))
        if possible_weights:
            weights_path = str(possible_weights[0])
        else:
            weights_path = input("学習済み重みファイル (.pt) のパスを入力してください: ").strip()

    if not weights_path or not os.path.exists(weights_path):
        print(f"エラー: 重みファイル '{weights_path}' が見つかりません。")
        return

    if not source_path:
        valid_images = list((PROJECT_ROOT / "datasets" / "LCD-1" / "valid" / "images").glob("*.*"))
        if valid_images:
            source_path = [str(p) for p in valid_images[:5]]
            print(f"推論対象: 検証用画像 5 枚を使用します。")
        else:
            source_path = input("推論する画像/動画/フォルダのパスを入力してください: ").strip()

    if not source_path:
        print("エラー: 推論対象が指定されていません。")
        return

    print(f"重みファイル: {weights_path}")
    print(f"TTA (Test-Time Augmentation): {'有効' if use_tta else '無効'}")
    print(f"モデルをロードして推論を実行中...")

    model = YOLO(weights_path)
    results = model.predict(
        source=source_path,
        conf=0.25,
        augment=use_tta,
        save=True,
        project=str(PROJECT_ROOT / "runs" / "predict"),
        name="predict_results_tta" if use_tta else "predict_results"
    )

    print("\n推論完了。結果画像の保存場所:")
    if isinstance(results, list) and len(results) > 0:
        print(f"- {results[0].save_dir}")

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else None
    w = sys.argv[2] if len(sys.argv) > 2 else None
    predict(src, w, use_tta=True)
