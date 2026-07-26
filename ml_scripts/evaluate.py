import os
import sys
from pathlib import Path
from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parent.parent

def evaluate(weights_path=None, use_tta=True):
    models_dir = PROJECT_ROOT / "models"
    
    if not weights_path:
        possible_weights = list(models_dir.glob("7-segment-digits-yolo26n.pt")) + list(models_dir.glob("*.pt")) + list(PROJECT_ROOT.rglob("*.pt"))
        if possible_weights:
            weights_path = str(possible_weights[0])

    if not weights_path or not os.path.exists(weights_path):
        print(f"エラー: 指定された重みファイル '{weights_path}' が見つかりません。")
        return

    print(f"モデル '{weights_path}' の評価（Validation Test, TTA={use_tta}）を開始します...")
    
    output_dir = PROJECT_ROOT / "runs" / "val"
    output_dir.mkdir(parents=True, exist_ok=True)

    data_yaml = PROJECT_ROOT / "datasets" / "LCD-1" / "data.yaml"

    model = YOLO(weights_path)

    metrics = model.val(
        data=str(data_yaml),
        imgsz=640,
        split="val",
        augment=use_tta,
        project=str(output_dir),
        name="val_results_tta" if use_tta else "val_results",
        exist_ok=True,
        workers=0,
        batch=16
    )

    print("\n" + "="*50)
    print(f"【評価結果サマリー (TTA={'有効' if use_tta else '無効'})】")
    print(f"  mAP50-95 (総合精度)   : {metrics.box.map:.4f}")
    print(f"  mAP50    (IoU 0.5精度): {metrics.box.map50:.4f}")
    print(f"  Precision (適合率)     : {metrics.box.mp:.4f}")
    print(f"  Recall    (再現率)     : {metrics.box.mr:.4f}")
    print("="*50)
    print(f"詳細結果の保存先: {metrics.save_dir}")

if __name__ == "__main__":
    w = sys.argv[1] if len(sys.argv) > 1 else None
    evaluate(w, use_tta=True)
